"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../store/useStore';
import { Video, MessagesSquare, PlaySquare } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const router = useRouter();
  const { setUserName, setRoomId } = useStore();
  
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !room.trim()) return;

    setUserName(name.trim());
    setRoomId(room.trim());
    
    router.push(`/room/${room.trim()}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass w-full max-w-md p-8 rounded-2xl relative z-10 shadow-2xl border border-white/10"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center gap-3 mb-4">
            <Video className="w-8 h-8 text-blue-500" />
            <MessagesSquare className="w-8 h-8 text-purple-500" />
            <PlaySquare className="w-8 h-8 text-pink-500" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
            Nexus Sync
          </h1>
          <p className="text-zinc-400 mt-2 text-sm">
            Video Calls • Real-time Chat • Watch Parties
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              placeholder="e.g. John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Room ID
            </label>
            <input
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-mono"
              placeholder="e.g. daily-standup"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium py-3 rounded-lg mt-6 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-500/25"
          >
            Join Room
          </button>
        </form>
      </motion.div>
    </div>
  );
}
