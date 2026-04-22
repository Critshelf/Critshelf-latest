import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import D20Die from '../D20Die';

export const D20Icon = ({ score, label, isGroup = false, groupName = '' }: { score: number, label: string, isGroup?: boolean, groupName?: string }) => {
  return (
    <div className="flex flex-col items-center gap-3">
      <D20Die value={score} size="lg" />
      <div className="text-center">
        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{label}</p>
        {isGroup && groupName && (
          <p className="text-[10px] font-black text-emerald-accent uppercase tracking-widest leading-none mt-1">{groupName}</p>
        )}
      </div>
    </div>
  );
};

export const VibeSystem = ({ vibes }: { vibes: { tag: string, percentage: number, color?: string }[] }) => {
  if (vibes.length === 0) {
    return (
      <div className="w-full">
        <h3 className="text-xs font-black text-white/40 uppercase tracking-widest mb-4">Vibe Check</h3>
        <p className="text-sm font-medium text-white/20 italic">No vibes recorded yet. Be the first to drop a review!</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-xs font-black text-white/40 uppercase tracking-widest mb-4">Vibe Check</h3>
      <div className="flex flex-col gap-4">
        {vibes.map((vibe, idx) => (
          <div key={vibe.tag} className="space-y-1.5">
            <div className="flex justify-between items-end">
              <span className="text-sm font-black text-white block truncate">{vibe.tag}</span>
              <span className="text-xs font-black text-gold-accent">{vibe.percentage}%</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${vibe.percentage}%` }}
                transition={{ delay: idx * 0.1, duration: 1 }}
                className={cn("h-full rounded-full transition-all bg-gold-accent")}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
