import { Video } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
       <div className="flex flex-col items-center gap-4">
         <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center animate-pulse">
           <Video className="w-8 h-8 text-blue-500 animate-bounce" />
         </div>
         <p className="text-zinc-400 font-medium text-sm tracking-widest uppercase">Connecting to Nexus...</p>
       </div>
    </div>
  );
}
