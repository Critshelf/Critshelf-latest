import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface ShareCollectionProps {
  userId: string;
}

export function ShareCollection({ userId }: ShareCollectionProps) {
  const [isCopied, setIsCopied] = useState(false);
  const publicUrl = `${window.location.origin}/collection/${userId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col items-center w-full max-w-md mx-auto shadow-xl">
      <h3 className="text-white font-bold mb-2">Share Your Collection</h3>
      <p className="text-slate-400 text-sm mb-6 text-center">
        Copy the link below to share your public game library with friends.
      </p>

      {/* Copy Link Section */}
      <div className="w-full relative flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={publicUrl}
          className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={handleCopy}
          className={cn(
            "absolute right-2 p-2 rounded-lg transition-all duration-300 font-medium text-xs flex items-center gap-1",
            isCopied 
              ? "bg-emerald-500 text-slate-900 hover:bg-emerald-400" 
              : "bg-slate-700 text-slate-200 hover:bg-slate-600"
          )}
          title="Copy Link"
        >
          {isCopied ? (
            <>
              <Check className="w-4 h-4" /> Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" /> Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}
