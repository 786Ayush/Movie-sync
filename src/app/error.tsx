"use client";

import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Nexus Sync Render Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#09090b] text-white">
      <div className="glass w-full max-w-md p-8 rounded-2xl relative z-10 shadow-2xl border border-red-500/20 text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
        <p className="text-zinc-400 mb-8 text-sm">
          We encountered an unexpected error while rendering this page.
        </p>

        <button
          onClick={() => reset()}
          className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="block w-full text-zinc-400 hover:text-white mt-4 text-sm transition-colors"
        >
          Return Home
        </button>
      </div>
    </div>
  );
}
