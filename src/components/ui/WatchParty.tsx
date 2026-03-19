"use client";

import React, { useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Tv2, Film } from 'lucide-react';

// Dynamically imported to avoid SSR issues with react-player
import dynamic from 'next/dynamic';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false }) as any;

interface WatchPartyProps {
  isHost: boolean;
  syncAction: (action: 'load' | 'play' | 'pause' | 'seek', payload: any) => void;
}

// Returns true if the URL should be played with native <video> tag
function isDirectVideoUrl(url: string): boolean {
  if (!url) return false;
  return (
    /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url) ||
    url.includes('/uploads/') ||
    url.startsWith('blob:')
  );
}

export const WatchParty = ({ isHost, syncAction }: WatchPartyProps) => {
  const { videoState } = useStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  // Flag to prevent echo: when we apply a remote event, we temporarily
  // set this to true so the resulting onPlay/onPause/onSeek callbacks don't re-emit.
  const isRemoteUpdate = useRef(false);

  const useDirect = isDirectVideoUrl(videoState.url);

  // ─── Apply remote/store changes to the player ────────────────────────────────
  useEffect(() => {
    if (!videoState.url) return;

    isRemoteUpdate.current = true;

    if (useDirect && videoRef.current) {
      const v = videoRef.current;
      // Sync time if drift > 1.5s
      if (Math.abs(v.currentTime - videoState.currentTime) > 1.5) {
        v.currentTime = videoState.currentTime;
      }
      // Sync play/pause
      if (videoState.playing && v.paused) {
        v.play().catch(() => {});
      } else if (!videoState.playing && !v.paused) {
        v.pause();
      }
    } else if (!useDirect && playerRef.current) {
      const current = playerRef.current.getCurrentTime?.() || 0;
      if (Math.abs(current - videoState.currentTime) > 1.5) {
        playerRef.current.seekTo(videoState.currentTime, 'seconds');
      }
      // ReactPlayer syncs play/pause through the `playing` prop automatically
    }

    // Allow user events again after a short delay
    const timer = setTimeout(() => { isRemoteUpdate.current = false; }, 200);
    return () => clearTimeout(timer);
  }, [videoState.playing, videoState.currentTime, videoState.url, useDirect]);

  // ─── Host-only handlers ──────────────────────────────────────────────────────
  const handlePlay = () => {
    if (!isHost || isRemoteUpdate.current) return;
    const time = useDirect ? (videoRef.current?.currentTime ?? 0) : (playerRef.current?.getCurrentTime?.() ?? 0);
    console.log('[WatchParty] ▶️  Host play at', time);
    syncAction('play', { currentTime: time });
  };

  const handlePause = () => {
    if (!isHost || isRemoteUpdate.current) return;
    const time = useDirect ? (videoRef.current?.currentTime ?? 0) : (playerRef.current?.getCurrentTime?.() ?? 0);
    console.log('[WatchParty] ⏸️  Host pause at', time);
    syncAction('pause', { currentTime: time });
  };

  const handleSeeked = () => {
    if (!isHost || isRemoteUpdate.current) return;
    const time = useDirect ? (videoRef.current?.currentTime ?? 0) : (playerRef.current?.getCurrentTime?.() ?? 0);
    console.log('[WatchParty] ⏩ Host seek to', time);
    syncAction('seek', { currentTime: time });
  };

  // ReactPlayer onSeek gives time as a number directly
  const handleReactPlayerSeek = (seconds: number) => {
    if (!isHost || isRemoteUpdate.current) return;
    console.log('[WatchParty] ⏩ Host seek (ReactPlayer) to', seconds);
    syncAction('seek', { currentTime: seconds });
  };

  // ─── Waiting screen ──────────────────────────────────────────────────────────
  if (!videoState.url) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black p-8 text-center">
        <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mb-5">
          <Film className="w-10 h-10 text-zinc-500" />
        </div>
        <h2 className="text-xl font-bold mb-1">Watch Party Stage</h2>
        <p className="text-zinc-500 text-sm max-w-xs">
          {isHost
            ? 'Use the "Watch Party" button below to load a video.'
            : 'Waiting for the host to load a video…'}
        </p>
        {!isHost && (
          <div className="mt-4 flex items-center gap-2 text-yellow-500/80 bg-yellow-500/10 border border-yellow-500/20 px-5 py-2 rounded-full text-sm">
            <Tv2 className="w-4 h-4" />
            <span>Only the host controls playback</span>
          </div>
        )}
      </div>
    );
  }

  // ─── Player ──────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full bg-black relative group overflow-hidden">
      {useDirect ? (
        /* Native video for .mp4 / /uploads/ / blob: */
        <video
          ref={videoRef}
          src={videoState.url}
          className="w-full h-full object-contain"
          controls={isHost}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeeked={handleSeeked}
        />
      ) : (
        /* ReactPlayer for YouTube and other external streams */
        <div className="w-full h-full">
          <ReactPlayer
            ref={playerRef}
            url={videoState.url}
            width="100%"
            height="100%"
            playing={videoState.playing}
            controls={isHost}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleReactPlayerSeek}
            style={{ backgroundColor: 'black' }}
          />
        </div>
      )}

      {/* Sync badge for guests */}
      {!isHost && (
        <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/60 border border-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-400">Synced to host</span>
        </div>
      )}
    </div>
  );
};
