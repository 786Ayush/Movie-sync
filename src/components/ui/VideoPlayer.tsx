import React from 'react';
import { MicOff } from 'lucide-react';

interface VideoPlayerProps {
  stream: MediaStream | null;
  name: string;
  isLocal?: boolean;
  className?: string;
}

export const VideoPlayer = ({ stream, name, isLocal = false, className = '' }: VideoPlayerProps) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [hasVideoTrack, setHasVideoTrack] = React.useState(false);
  const [hasAudioTrack, setHasAudioTrack] = React.useState(false);

  React.useEffect(() => {
    if (stream) {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => {
          console.warn("[VideoPlayer] Autoplay blocked or failed:", err.message);
        });
      }
      
      const checkTracks = () => {
        const vTracks = stream.getVideoTracks();
        const aTracks = stream.getAudioTracks();
        setHasVideoTrack(vTracks.length > 0 && vTracks[0].enabled);
        setHasAudioTrack(aTracks.length > 0 && aTracks[0].enabled);
      };

      checkTracks();
      const interval = setInterval(checkTracks, 1000);
      return () => clearInterval(interval);
    } else {
      setHasVideoTrack(false);
      setHasAudioTrack(false);
    }
  }, [stream]);

  return (
    <div className={`relative group overflow-hidden bg-zinc-900 border border-white/10 h-full w-full flex items-center justify-center shadow-lg ${className}`}>
      
      {/* Video Element (rendered even if "off" so Stream doesn't drop, just visually hidden) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Don't hear yourself
        className={`w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 ${isLocal ? 'scale-x-[-1]' : ''} ${hasVideoTrack ? 'opacity-100' : 'opacity-0 absolute'}`}
      />

      {/* Fallback Avatar UI */}
      {!hasVideoTrack && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 text-zinc-500 absolute inset-0 z-0">
          <div className="w-20 h-20 rounded-full bg-zinc-700/80 flex items-center justify-center mb-3 shadow-inner">
            <span className="text-3xl font-medium text-zinc-300 drop-shadow-sm">{name ? name.charAt(0).toUpperCase() : '?'}</span>
          </div>
          <p className="text-sm font-medium">Camera Off</p>
        </div>
      )}
      
      {/* Lower Third Info */}
      <div className="absolute bottom-0 left-0 right-0 p-3 pt-6 bg-gradient-to-t from-black/90 to-transparent z-10 flex items-center justify-between">
        <span className="text-sm font-medium text-white drop-shadow-md truncate max-w-[80%]">
          {name} {isLocal && '(You)'}
        </span>
        
        {/* Muted Indicator */}
        {!hasAudioTrack && (
           <div className="bg-red-500/90 rounded-full p-1.5 backdrop-blur-sm self-end">
             <MicOff className="w-3.5 h-3.5 text-white" />
           </div>
        )}
      </div>
    </div>
  );
};
