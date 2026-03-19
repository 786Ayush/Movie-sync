import Link from 'next/link';
import { Home, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#09090b] text-white">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Compass className="w-10 h-10 text-blue-500" />
        </div>
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">404</h1>
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Room Not Found</h2>
        <p className="text-zinc-400 mb-8">
          The room or page you are looking for doesn't exist or has been removed.
        </p>

        <Link 
          href="/"
          className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white px-6 py-3 rounded-lg font-medium transition-all"
        >
          <Home className="w-4 h-4" />
          Go back home
        </Link>
      </div>
    </div>
  );
}
