import React, { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface ChatPanelProps { 
  sendMessage: (text: string) => void;
  isMobileDrawer?: boolean;
  onClose?: () => void;
}

export const ChatPanel = ({ sendMessage, isMobileDrawer, onClose }: ChatPanelProps) => {
  const { messages, userName } = useStore();
  const [text, setText] = React.useState('');
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      sendMessage(text.trim());
      setText('');
    }
  };

  return (
    <div className={`flex flex-col h-full bg-black/40 border-l border-white/10 ${isMobileDrawer ? 'w-full' : 'w-80'} shrink-0 shadow-xl z-50 backdrop-blur-md relative`}>
      <div className="p-4 border-b border-white/10 font-medium text-zinc-200 flex justify-between items-center">
        <span>In-Call Chat</span>
        {isMobileDrawer && onClose && (
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.senderName === userName;
          return (
             <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <span className="text-xs text-zinc-500 mb-1 px-1">
                {isMe ? 'You' : msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <div 
                className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                  isMe 
                    ? 'bg-blue-600/90 text-white rounded-br-sm' 
                    : 'bg-zinc-800/80 text-zinc-100 rounded-bl-sm'
                }`}
              >
                <p className="text-sm shadow-sm break-words">{msg.text}</p>
              </div>
            </motion.div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-black/20">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
        />
      </form>
    </div>
  );
};
