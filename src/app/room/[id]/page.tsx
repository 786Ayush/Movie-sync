"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '../../../store/useStore';
import { useSocket } from '../../../hooks/useSocket';
import { useWebRTC } from '../../../hooks/useWebRTC';
import { ChatPanel } from '../../../components/ui/ChatPanel';
import { WatchParty } from '../../../components/ui/WatchParty';
import { VideoPlayer } from '../../../components/ui/VideoPlayer';

import {
  Mic, MicOff, Video, VideoOff, ScreenShare, LogOut,
  MessageSquare, PlaySquare, Users, X, Film, Upload,
  Loader2, AlertTriangle, Youtube, Link
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';

/** Returns true if the URL looks like a YouTube link */
function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be|youtube-nocookie\.com/i.test(url);
}

/** Basic check: accepts YouTube, direct videos, or any absolute URL that isn't a known local path */
function isSupportedUrl(url: string): boolean {
  if (!url.trim()) return false;
  try { 
    const u = new URL(url); 
    // Accept YouTube or common video extensions
    return (
      isYouTubeUrl(url) ||
      /\.(mp4|webm|ogg|mov|m4v|m3u8|mpd)(\?.*)?$/i.test(url) ||
      url.includes('/uploads/') ||
      url.startsWith('blob:')
    );
  } catch { 
    return false; 
  }
}

export default function Room() {
  const params = useParams();
  const roomId = params.id as string;
  const router = useRouter();

  const { userName, users, videoState, hostId } = useStore();
  const { socket, isConnected, joinRoom, sendMessage, syncVideoAction } = useSocket();
  const {
    localStream,
    remoteStreams,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
  } = useWebRTC(socket, roomId);

  // ─── UI State ─────────────────────────────────────────────────────────────
  const [showChat, setShowChat] = useState(false);
  const [showWatchPartyModal, setShowWatchPartyModal] = useState(false);
  const [wpUrlInput, setWpUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [urlError, setUrlError] = useState('');

  const prevUsersRef = useRef<typeof users>([]);

  // ─── Auth Guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userName) router.replace('/');
  }, [userName, router]);

  // ─── Join Room ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isConnected && userName) {
      console.log('[Room] 🚪 Joining room:', roomId, 'as', userName);
      joinRoom(roomId, userName);
    }
  }, [isConnected, roomId, userName]);

  // ─── Toast: Join / Leave ───────────────────────────────────────────────────
  useEffect(() => {
    const prev = prevUsersRef.current;
    const current = users;
    if (prev.length > 0 || current.length > 0) {
      current
        .filter(u => !prev.find(pu => pu.socketId === u.socketId) && u.socketId !== socket?.id)
        .forEach(u => toast.success(`${u.name} joined!`, { style: { background: '#27272a', color: '#fff' } }));
      prev
        .filter(pu => !current.find(u => u.socketId === pu.socketId) && pu.socketId !== socket?.id)
        .forEach(u => toast(`${u.name} left.`, { icon: '👋', style: { background: '#27272a', color: '#fff' } }));
    }
    prevUsersRef.current = users;
  }, [users, socket]);

  if (!userName) return null;

  // ─── Derived ──────────────────────────────────────────────────────────────
  const isWatchPartyActive = videoState.url !== '';
  const isHost = socket?.id === hostId;

  const remoteUsersItems = users
    .filter(u => u.socketId !== socket?.id)
    .map(u => ({ name: u.name, stream: remoteStreams[u.socketId] || null, socketId: u.socketId }));

  const totalVideos = 1 + remoteUsersItems.length;

  // ─── Watch Party: Open Modal ──────────────────────────────────────────────
  const openWatchPartyModal = () => {
    if (!isHost) {
      toast('Only the host can start a Watch Party 👑', {
        icon: '🎬',
        style: { background: '#27272a', color: '#fff' },
      });
      return;
    }
    setWpUrlInput('');
    setUrlError('');
    setShowWatchPartyModal(true);
  };

  // ─── Watch Party: Submit URL ───────────────────────────────────────────────
  const handleWpUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = wpUrlInput.trim();
    if (!url) return;

    // Validate that react-player can actually handle this URL
    if (!isSupportedUrl(url)) {
      setUrlError(
        isYouTubeUrl(url)
          ? 'YouTube URL detected but appears malformed. Try: https://youtu.be/VIDEO_ID'
          : 'This URL type is not supported. Try a YouTube link or a direct .mp4/.webm URL.'
      );
      return;
    }

    console.log('[WatchParty] 🎬 Host loading URL:', url, '| YouTube?', isYouTubeUrl(url));
    console.log('[WatchParty] 📡 Emitting video:load socket event');
    syncVideoAction('load', { url });
    setShowWatchPartyModal(false);
    toast.success(`Watch Party started! ${isYouTubeUrl(url) ? '▶️ YouTube' : '🎥 Video'}`, {
      style: { background: '#27272a', color: '#fff' },
    });
  };

  // ─── Watch Party: Upload Local File ───────────────────────────────────────
  // We upload the file to our backend server so ALL users get a real HTTP URL.
  const handleWpFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    toast.loading('Uploading video…', { id: 'upload', style: { background: '#27272a', color: '#fff' } });

    try {
      const formData = new FormData();
      formData.append('video', file);

      const res = await fetch('/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const { url } = await res.json();

      console.log('[WatchParty] ✅ File uploaded. Public URL:', url);
      console.log('[WatchParty] 📡 Emitting video:load socket event');
      syncVideoAction('load', { url });
      setShowWatchPartyModal(false);
      toast.success('Watch Party started! 🎥 Video uploaded & synced.', {
        id: 'upload',
        style: { background: '#27272a', color: '#fff' },
      });
    } catch (err: any) {
      console.error('[WatchParty] Upload failed:', err);
      toast.error(`Upload failed: ${err.message}`, { id: 'upload' });
    } finally {
      setIsUploading(false);
    }
  };

  // ─── Watch Party: Exit ────────────────────────────────────────────────────
  const handleExitWatchParty = () => {
    if (!isHost) return;
    syncVideoAction('load', { url: '' });
  };

  return (
    <div className="h-[100dvh] w-full bg-[#09090b] text-white flex flex-col overflow-hidden relative">
      <Toaster position="top-center" />

      {/* ── Watch Party Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showWatchPartyModal && (
          <motion.div
            key="wp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowWatchPartyModal(false)}
          >
            <motion.div
              key="wp-modal"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 260 }}
              className="glass rounded-2xl p-8 w-full max-w-md shadow-2xl relative border border-white/10"
              onClick={e => e.stopPropagation()}
            >
              {/* Close */}
              <button
                onClick={() => setShowWatchPartyModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                disabled={isUploading}
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header */}
              <div className="mb-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600/30 to-purple-600/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                  <Film className="w-8 h-8 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold">Start Watch Party</h2>
                <p className="text-zinc-400 text-sm mt-1">Watch any video together, in sync</p>
              </div>

              {/* ── URL Section ─────────────────────────────────────────────── */}
              <form onSubmit={handleWpUrlSubmit} className="space-y-3 mb-4">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Link className="w-3.5 h-3.5" /> Paste a URL
                </p>

                {/* YouTube tip */}
                <div className="flex items-center gap-2 text-zinc-500 text-xs bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                  <Youtube className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  Supports YouTube links (youtu.be, youtube.com/watch)
                </div>

                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://youtu.be/… or https://…/video.mp4"
                    value={wpUrlInput}
                    onChange={e => { setWpUrlInput(e.target.value); setUrlError(''); }}
                    autoFocus
                    disabled={isUploading}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isUploading || !wpUrlInput.trim()}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 rounded-lg font-medium transition-colors text-sm whitespace-nowrap"
                  >
                    Load
                  </button>
                </div>

                {/* URL validation error */}
                {urlError && (
                  <p className="text-red-400 text-xs flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {urlError}
                  </p>
                )}
              </form>

              {/* Divider */}
              <div className="relative flex items-center gap-3 mb-4">
                <div className="flex-1 border-t border-white/10" />
                <span className="text-xs text-zinc-500">or</span>
                <div className="flex-1 border-t border-white/10" />
              </div>

              {/* ── File Upload Section ──────────────────────────────────────── */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" /> Upload a local file
                </p>

                <label
                  className={`block cursor-pointer bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-lg py-5 px-2 transition-colors text-center ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isUploading ? (
                    <div className="flex items-center justify-center gap-2 text-blue-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-medium">Uploading…</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-zinc-400 mx-auto mb-1.5" />
                      <span className="text-sm font-medium text-zinc-300">Choose .mp4 or .webm file</span>
                      <p className="text-xs text-zinc-500 mt-1">File is uploaded to the server so everyone can watch</p>
                    </>
                  )}
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    className="hidden"
                    onChange={handleWpFileUpload}
                    disabled={isUploading}
                  />
                </label>

                <p className="text-xs text-zinc-600 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-yellow-600" />
                  Max 500 MB. File is uploaded once and shared with all viewers.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header
        className={`h-14 md:h-16 border-b border-white/10 glass px-4 md:px-6 flex items-center justify-between z-20 shrink-0 transition-transform duration-500 ${
          isWatchPartyActive ? '-translate-y-full hover:translate-y-0 absolute top-0 left-0 right-0' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="font-semibold text-base md:text-lg hidden sm:block">Nexus Sync</h1>
          </div>
          <div className="h-4 w-px bg-white/20 mx-1 hidden sm:block" />
          <p className="text-zinc-400 font-mono text-xs md:text-sm bg-zinc-900/50 px-2 py-1 rounded">
            Room: {roomId}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isHost && (
            <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full border border-blue-500/20 font-bold">
              Host
            </span>
          )}
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 text-xs md:text-sm">
            <Users className="w-4 h-4 text-zinc-400" />
            <span className="font-medium text-blue-400">{users.length + 1}</span>
          </div>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">

          {/* Stage */}
          <div className="flex-1 overflow-hidden relative bg-black">
            <div className="w-full h-full relative">
              {isWatchPartyActive ? (
                /* Cinema Mode */
                <div className="w-full h-full">
                  <WatchParty syncAction={syncVideoAction} isHost={isHost} />

                  {/* Floating participant circles */}
                  <div className="absolute top-6 right-6 flex flex-col gap-4 pointer-events-none z-30">
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl pointer-events-auto bg-zinc-900 group relative circular-video">
                      <VideoPlayer stream={localStream} name={userName} isLocal className="rounded-full" />
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/50 opacity-0 group-hover:opacity-100 transition-opacity">Me</div>
                    </div>
                    {remoteUsersItems.map(peer => (
                      <div key={`float-${peer.socketId}`} className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl pointer-events-auto bg-zinc-900 group relative circular-video">
                        <VideoPlayer stream={peer.stream} name={peer.name} className="rounded-full" />
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/50 opacity-0 group-hover:opacity-100 transition-opacity truncate max-w-[80%]">{peer.name}</div>
                      </div>
                    ))}
                  </div>

                  {/* Exit button (host only) */}
                  {isHost && (
                    <button
                      onClick={handleExitWatchParty}
                      className="absolute top-6 left-6 z-30 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-zinc-400 hover:text-white hover:bg-black/80 text-xs font-medium transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                      Exit Watch Party
                    </button>
                  )}
                </div>
              ) : (
                /* Normal Video Grid */
                <div className="p-4 md:p-8 h-full flex flex-col items-center justify-center">
                  <div className={`grid gap-4 w-full max-w-7xl h-full items-center ${
                    totalVideos === 1 ? 'grid-cols-1 max-w-2xl' :
                    totalVideos === 2 ? 'grid-cols-1 md:grid-cols-2' :
                    'grid-cols-2 lg:grid-cols-3'
                  }`}>
                    <div className="w-full aspect-video rounded-3xl overflow-hidden glass shadow-2xl border border-white/10">
                      <VideoPlayer stream={localStream} name={userName} isLocal className="rounded-3xl" />
                    </div>
                    {remoteUsersItems.map(peer => (
                      <div key={`video-${peer.socketId}`} className="w-full aspect-video rounded-3xl overflow-hidden glass shadow-2xl border border-white/10">
                        <VideoPlayer stream={peer.stream} name={peer.name} className="rounded-3xl" />
                      </div>
                    ))}
                  </div>
                  {totalVideos === 1 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
                      <PlaySquare className="w-24 h-24 mb-4" />
                      <p className="font-medium">Alone in the Nexus</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Controls Bar ────────────────────────────────────────────────── */}
          <div className="h-auto py-3 md:h-20 glass border-t border-white/10 shrink-0 flex flex-wrap md:flex-nowrap items-center justify-between px-2 md:px-8 z-20 backdrop-blur-xl bg-black/80 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">

            {/* Left — Watch Party */}
            <div className="flex w-full md:w-1/3 justify-center md:justify-start mb-2 md:mb-0 gap-2">
              <button
                onClick={isWatchPartyActive ? (isHost ? handleExitWatchParty : undefined) : openWatchPartyModal}
                title={!isHost && !isWatchPartyActive ? 'Only the host can start a Watch Party' : undefined}
                className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-lg font-medium transition-all text-sm md:text-base ${
                  isWatchPartyActive
                    ? isHost
                      ? 'bg-pink-600/30 text-pink-300 border border-pink-500/40 hover:bg-pink-600/50'
                      : 'bg-pink-600/20 text-pink-400 border border-pink-500/30 cursor-default'
                    : isHost
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    : 'bg-zinc-800/50 text-zinc-500 cursor-not-allowed'
                }`}
              >
                <PlaySquare className="w-4 h-4 md:w-5 md:h-5" />
                <span>
                  {isWatchPartyActive
                    ? isHost ? 'Exit Party' : 'Watch Party 🎬'
                    : 'Watch Party'}
                </span>
              </button>
            </div>

            {/* Center — Mic / Cam / Screen / Leave */}
            <div className="flex items-center gap-2 md:gap-4 w-full md:w-1/3 justify-center">
              <button
                onClick={toggleAudio}
                className={`p-3 md:p-4 rounded-full transition-all shadow-lg ${isAudioEnabled ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'}`}
              >
                {isAudioEnabled ? <Mic className="w-5 h-5 md:w-6 md:h-6" /> : <MicOff className="w-5 h-5 md:w-6 md:h-6" />}
              </button>
              <button
                onClick={toggleVideo}
                className={`p-3 md:p-4 rounded-full transition-all shadow-lg ${isVideoEnabled ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'}`}
              >
                {isVideoEnabled ? <Video className="w-5 h-5 md:w-6 md:h-6" /> : <VideoOff className="w-5 h-5 md:w-6 md:h-6" />}
              </button>
              <button
                onClick={toggleScreenShare}
                className={`p-3 md:p-4 rounded-full transition-all shadow-lg hidden sm:block ${isScreenSharing ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}
              >
                <ScreenShare className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              <button
                onClick={() => {
                  if (localStream) localStream.getTracks().forEach(t => t.stop());
                  router.push('/');
                  setTimeout(() => window.location.reload(), 100);
                }}
                className="p-3 md:p-4 rounded-full bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-500/20"
              >
                <LogOut className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>

            {/* Right — Chat (desktop) */}
            <div className="hidden md:flex items-center justify-end w-full md:w-1/3">
              <button
                onClick={() => setShowChat(!showChat)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all text-sm md:text-base ${showChat ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
              >
                <MessageSquare className="w-4 h-4 md:w-5 md:h-5" />
                <span>Chat ({users.length})</span>
              </button>
            </div>

            {/* Mobile Chat toggle */}
            <button
              onClick={() => setShowChat(true)}
              className="md:hidden absolute right-4 top-[-60px] bg-zinc-800/90 backdrop-blur p-3 rounded-full text-white shadow-lg border border-white/10"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Desktop Chat Sidebar */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="h-full z-10 hidden md:block"
            >
              <ChatPanel sendMessage={sendMessage} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Chat Drawer */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-0 z-50 md:hidden bg-zinc-900"
            >
              <ChatPanel sendMessage={sendMessage} isMobileDrawer onClose={() => setShowChat(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
