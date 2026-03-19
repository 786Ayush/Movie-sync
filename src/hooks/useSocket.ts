import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '../store/useStore';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const { setUsers, addUser, removeUser, addMessage, setVideoState } = useStore();
  const [isConnected, setIsConnected] = useState(false);
  // Keep a state copy so components re-render when the socket is ready
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const BACKEND_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
    console.log('[Socket] 🔌 Connecting to:', BACKEND_URL);

    const s = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = s;

    s.on('connect_error', (err) => {
      console.error('[Socket] ❌ Connection Error:', err.message);
    });

    s.on('connect', () => {
      console.log('[Socket] ✅ Connected. ID:', s.id);
      setIsConnected(true);
      // Expose the socket instance to consumers so they can use s.id immediately
      setSocket(s);
    });

    s.on('disconnect', (reason) => {
      console.warn('[Socket] ⚠️ Disconnected:', reason);
      setIsConnected(false);
    });

    // ─── Room/User Events ────────────────────────────────────────────────────
    s.on('room-users', (users) => {
      console.log('[Socket] 👥 room-users:', users.length);
      setUsers(users);
    });

    s.on('user-joined', (user) => {
      console.log('[Socket] 👤 user-joined:', user.name);
      addUser(user);
    });

    s.on('user-disconnected', (socketId) => {
      console.log('[Socket] 👋 user-disconnected:', socketId);
      removeUser(socketId);
    });

    s.on('receive-message', (message) => {
      addMessage(message);
    });

    s.on('sync-host', (hostId) => {
      console.log('[Socket] 👑 New host:', hostId);
      useStore.getState().setHostId(hostId);
    });

    // ─── Watch Party Events (watch:*) ────────────────────────────────────────
    s.on('watch:sync', (state) => {
      console.log('[Watch] 🔄 Initial sync state:', state);
      setVideoState(state);
    });

    s.on('watch:load', ({ url }) => {
      console.log('[Watch] 🎬 Load video:', url);
      setVideoState({ url, playing: false, currentTime: 0 });
    });

    s.on('watch:play', ({ currentTime }) => {
      console.log('[Watch] ▶️  Play at:', currentTime);
      setVideoState({ playing: true, currentTime });
    });

    s.on('watch:pause', ({ currentTime }) => {
      console.log('[Watch] ⏸️  Pause at:', currentTime);
      setVideoState({ playing: false, currentTime });
    });

    s.on('watch:seek', ({ currentTime }) => {
      console.log('[Watch] ⏩ Seek to:', currentTime);
      setVideoState({ currentTime });
    });

    return () => {
      console.log('[Socket] 🔌 Disconnecting...');
      s.disconnect();
      setSocket(null);
    };
  }, []);

  const joinRoom = (roomId: string, userName: string) => {
    console.log('[Socket] 🚪 Joining room:', roomId, 'as', userName);
    socketRef.current?.emit('join-room', { roomId, userName });
  };

  const sendMessage = (text: string) => {
    socketRef.current?.emit('send-message', { text });
  };

  const syncVideoAction = (action: 'load' | 'play' | 'pause' | 'seek', payload: any) => {
    const event = `watch:${action}`;
    console.log(`[Watch] 📡 Emit ${event}`, payload);
    socketRef.current?.emit(event, payload);
  };

  return {
    socket,          // ← stateful: updates when connected so components re-render
    isConnected,
    joinRoom,
    sendMessage,
    syncVideoAction,
  };
};
