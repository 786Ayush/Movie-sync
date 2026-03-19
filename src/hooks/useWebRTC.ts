import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface PeerConnection {
  peerConnection: RTCPeerConnection;
  stream: MediaStream;
  socketId: string;
}

export const useWebRTC = (socket: Socket | null, roomId: string) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const peersRef = useRef<Record<string, PeerConnection>>({});
  const pendingCandidates = useRef<Record<string, RTCIceCandidateInit[]>>({});

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  const updateLocalStream = (stream: MediaStream | null) => {
    setLocalStream(stream);
    localStreamRef.current = stream;
  };

  const getMedia = useCallback(async (video = true, audio = true) => {
    try {
      console.log("[WebRTC] Requesting local media...");
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      updateLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('[WebRTC] Failed to get local stream', err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    console.log("[WebRTC] Setting up signaling listeners...");

    const handleUserJoined = async (user: {socketId: string, name: string}) => {
      console.log(`[WebRTC] User ${user.name} joined. Making OFFER to:`, user.socketId);
      
      let stream = localStreamRef.current;
      if (!stream) {
         stream = await getMedia();
      }
      
      if (stream) {
        callPeer(user.socketId, stream);
      } else {
        console.warn("[WebRTC] Cannot call peer, local stream not available.");
      }
    };

    const handleWebRTCOffer = async ({ caller, sdp }: {caller: string, sdp: any}) => {
      console.log(`[WebRTC] Received OFFER from`, caller);
      
      let stream = localStreamRef.current;
      if (!stream) {
        stream = await getMedia();
      }
      
      if (stream) {
        answerPeer(caller, sdp, stream);
      } else {
        console.warn("[WebRTC] Cannot answer peer, local stream not available.");
      }
    };

    const handleWebRTCAnswer = async ({ caller, sdp }: {caller: string, sdp: any}) => {
      console.log(`[WebRTC] Received ANSWER from`, caller);
      const peer = peersRef.current[caller];
      if (peer) {
        try {
          await peer.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
          console.log(`[WebRTC] Successfully set remote description for`, caller);
          
          if (pendingCandidates.current[caller]) {
            console.log(`[WebRTC] Processing ${pendingCandidates.current[caller].length} buffered ICE candidates for`, caller);
            for (const candidate of pendingCandidates.current[caller]) {
              await peer.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
            delete pendingCandidates.current[caller];
          }
        } catch (error) {
           console.error("[WebRTC] Error setting remote description for answer:", error);
        }
      } else {
        console.warn("[WebRTC] Received answer but no peer connection found for", caller);
      }
    };

    const handleWebRTCICECandidate = async ({ candidate, caller }: {candidate: any, caller: string}) => {
      console.log(`[WebRTC] Received ICE candidate from`, caller);
      const peer = peersRef.current[caller];
      
      if (peer && peer.peerConnection.remoteDescription) {
        try {
          await peer.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("[WebRTC] Error adding received ice candidate", e);
        }
      } else {
         console.log(`[WebRTC] Buffering ICE candidate for`, caller, `(remote description not set)`);
         if (!pendingCandidates.current[caller]) {
           pendingCandidates.current[caller] = [];
         }
         pendingCandidates.current[caller].push(candidate);
      }
    };

    const handleUserDisconnected = (socketId: string) => {
      console.log(`[WebRTC] User disconnected:`, socketId);
      if (peersRef.current[socketId]) {
        peersRef.current[socketId].peerConnection.close();
        delete peersRef.current[socketId];
      }
      if (pendingCandidates.current[socketId]) {
        delete pendingCandidates.current[socketId];
      }
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    socket.on('user-joined', handleUserJoined);
    socket.on('webrtc-offer', handleWebRTCOffer);
    socket.on('webrtc-answer', handleWebRTCAnswer);
    socket.on('webrtc-ice-candidate', handleWebRTCICECandidate);
    socket.on('user-disconnected', handleUserDisconnected);

    if (!localStreamRef.current) {
        getMedia();
    }

    return () => {
      console.log("[WebRTC] Tearing down signaling listeners...");
      socket.off('user-joined', handleUserJoined);
      socket.off('webrtc-offer', handleWebRTCOffer);
      socket.off('webrtc-answer', handleWebRTCAnswer);
      socket.off('webrtc-ice-candidate', handleWebRTCICECandidate);
      socket.off('user-disconnected', handleUserDisconnected);
    };
  }, [socket, getMedia]);

  const createPeerConnection = (targetSocketId: string, stream: MediaStream): RTCPeerConnection => {
    console.log(`[WebRTC] Creating peer connection for`, targetSocketId);
    
    // Cleanup existing peer if one exists accidentally
    if (peersRef.current[targetSocketId]) {
       console.log(`[WebRTC] Cleaning up stale peer for`, targetSocketId);
       peersRef.current[targetSocketId].peerConnection.close();
    }

    const pc = new RTCPeerConnection(configuration);

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-ice-candidate', {
          target: targetSocketId,
          candidate: event.candidate,
          caller: socket.id
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`[WebRTC] 📹 Received remote track from`, targetSocketId);
      if (event.streams && event.streams[0]) {
        setRemoteStreams((prev) => ({
          ...prev,
          [targetSocketId]: event.streams[0]
        }));
      }
    };

    pc.onconnectionstatechange = () => {
        console.log(`[WebRTC] Connection state with ${targetSocketId}:`, pc.connectionState);
    };

    peersRef.current[targetSocketId] = {
      peerConnection: pc,
      stream: new MediaStream(),
      socketId: targetSocketId
    };

    return pc;
  };

  const callPeer = async (targetSocketId: string, stream: MediaStream) => {
    const pc = createPeerConnection(targetSocketId, stream);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log(`[WebRTC] Emitting OFFER to`, targetSocketId);
      socket?.emit('webrtc-offer', {
        target: targetSocketId,
        caller: socket.id,
        sdp: pc.localDescription
      });
    } catch(err) {
      console.error("[WebRTC] Error creating offer", err);
    }
  };

  const answerPeer = async (callerSocketId: string, sdp: RTCSessionDescriptionInit, stream: MediaStream) => {
    const pc = createPeerConnection(callerSocketId, stream);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log(`[WebRTC] Successfully set remote description for offer from`, callerSocketId);
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      console.log(`[WebRTC] Emitting ANSWER to`, callerSocketId);
      socket?.emit('webrtc-answer', {
        target: callerSocketId,
        caller: socket?.id,
        sdp: pc.localDescription
      });

      if (pendingCandidates.current[callerSocketId]) {
         console.log(`[WebRTC] Processing ${pendingCandidates.current[callerSocketId].length} buffered ICE candidates for`, callerSocketId);
         for (const candidate of pendingCandidates.current[callerSocketId]) {
           await pc.addIceCandidate(new RTCIceCandidate(candidate));
         }
         delete pendingCandidates.current[callerSocketId];
      }

    } catch (err) {
       console.error("[WebRTC] Error answering peer", err);
    }
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        const newStream = await getMedia(isVideoEnabled, isAudioEnabled);
        if (newStream) {
          replaceTrack(newStream.getVideoTracks()[0]);
          setIsScreenSharing(false);
        }
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        
        replaceTrack(screenTrack);
        setIsScreenSharing(true);

        screenTrack.onended = async () => {
          const newStream = await getMedia(isVideoEnabled, isAudioEnabled);
          if (newStream) {
            replaceTrack(newStream.getVideoTracks()[0]);
            setIsScreenSharing(false);
          }
        };
      }
    } catch (error) {
      console.error("Error sharing screen", error);
    }
  };

  const replaceTrack = (newTrack: MediaStreamTrack) => {
    Object.values(peersRef.current).forEach(peer => {
      const sender = peer.peerConnection.getSenders().find(s => s.track?.kind === newTrack.kind);
      if (sender) {
        sender.replaceTrack(newTrack);
      }
    });

    const stream = localStreamRef.current;
    if (stream) {
      const currentTrack = stream.getVideoTracks()[0];
      stream.removeTrack(currentTrack);
      stream.addTrack(newTrack);
      updateLocalStream(new MediaStream(stream.getTracks()));
    }
  };

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      Object.values(peersRef.current).forEach(peer => peer.peerConnection.close());
    };
  }, []);

  return {
    localStream,
    remoteStreams,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    toggleVideo,
    toggleAudio,
    toggleScreenShare
  };
};
