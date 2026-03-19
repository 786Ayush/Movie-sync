"use client";

import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { Tv2, Film, Loader2 } from 'lucide-react';

// Use react-player's full version to ensure YouTube is registered
import dynamic from 'next/dynamic';
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false }) as any;

interface WatchPartyProps {
  isHost: boolean;
  syncAction: (action: 'load' | 'play' | 'pause' | 'seek', payload: any) => void;
}

/** Returns true if the URL should be played directly with a native <video> tag */
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
  const [isReady, setIsReady] = useState(false);
  const [playerError, setPlayerError] = useState(false);

  // For direct video (<video> tag)
  const videoRef = useRef<HTMLVideoElement>(null);

  // For ReactPlayer (Ref gives you the underlying video-like element in v3)
  const playerRef = useRef<any>(null);

  // Prevent echo: when we apply a remote/store change, don't re-emit it back
  const isRemoteUpdate = useRef(false);

  const useDirect = isDirectVideoUrl(videoState.url);

  // ─── Apply remote/store state changes to the player ───────────────────────
  useEffect(() => {
    if (!videoState.url) return;
    
    // When a new URL is loaded, reset ready state
    // (Note: This useEffect runs for URL, playing, and currentTime changes)
  }, [videoState.url]);

  useEffect(() => {
    if (!videoState.url) return;

    // Use a short delay for sync to ensure the element exists
    const timer = setTimeout(() => {
      isRemoteUpdate.current = true;
      const el = useDirect ? videoRef.current : playerRef.current;
      
      if (el) {
        // 1. Sync Time (if drift > 1.5s)
        if (Math.abs(el.currentTime - videoState.currentTime) > 1.5) {
          el.currentTime = videoState.currentTime;
        }

        // 2. Sync Playback State
        if (videoState.playing && el.paused) {
          el.play().catch((err: any) => {
            console.warn('[WatchParty] Play failed (probably user interation needed):', err);
          });
        } else if (!videoState.playing && !el.paused) {
          el.pause();
        }
      }
      
      // Release remote update lock
      setTimeout(() => { isRemoteUpdate.current = false; }, 200);
    }, 50);

    return () => clearTimeout(timer);
  }, [videoState.playing, videoState.currentTime, videoState.url, useDirect]);

  // ─── Media event handlers (Host only) ───────────────────────────────────
  const getTime = () => {
    const el = useDirect ? videoRef.current : playerRef.current;
    return el?.currentTime ?? 0;
  };

  const handlePlay = () => {
    if (!isHost || isRemoteUpdate.current) return;
    const time = getTime();
    console.log('[WatchParty] ▶️ Host play at', time);
    syncAction('play', { currentTime: time });
  };

  const handlePause = () => {
    if (!isHost || isRemoteUpdate.current) return;
    const time = getTime();
    console.log('[WatchParty] ⏸️ Host pause at', time);
    syncAction('pause', { currentTime: time });
  };

  const handleSeeked = () => {
    if (!isHost || isRemoteUpdate.current) return;
    const time = getTime();
    console.log('[WatchParty] ⏩ Host seeked to', time);
    syncAction('seek', { currentTime: time });
  };

  // ─── Rendering ──────────────────────────────────────────────────────────
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
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black relative group overflow-hidden">
      {!isReady && !playerError && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}

      {playerError && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-900/90 p-6 text-center">
          <Film className="w-12 h-12 text-red-500 mb-3" />
          <h3 className="text-lg font-bold">Failed to load video</h3>
          <p className="text-sm text-zinc-400 mt-1 max-w-xs"> The URL might be blocked or the video ID is incorrect. </p>
        </div>
      )}

      {useDirect ? (
        <video
          ref={videoRef}
          src={videoState.url}
          className="w-full h-full object-contain"
          controls={isHost}
          playsInline
          onCanPlay={() => setIsReady(true)}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeeked={handleSeeked}
          onError={() => setPlayerError(true)}
        />
      ) : (
        <div className="w-full h-full">
          <ReactPlayer
            ref={playerRef}
            src={videoState.url}
            // Also pass url prop for older versions of react-player if needed
            url={videoState.url}
            width="100%"
            height="100%"
            playing={videoState.playing}
            controls={isHost}
            playsInline
            onReady={() => {
              setIsReady(true);
              setPlayerError(false);
            }}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeeked={handleSeeked}
            onError={() => setPlayerError(true)}
            style={{ backgroundColor: 'black' }}
          />
        </div>
      )}

      {!isHost && isReady && (
        <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/60 border border-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-400">Synced to host</span>
        </div>
      )}
    </div>
  );
};
