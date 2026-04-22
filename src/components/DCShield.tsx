import React, { useState } from 'react';
import { Shield, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface DCShieldProps {
  value: number | '-';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  totalUserRatings?: number;
}

export default function DCShield({ value, size = 'md', className, totalUserRatings = 0 }: DCShieldProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const sizes = {
    sm: {
      container: "w-8 h-8",
      text: "text-[10px]",
      tooltipOffset: "-top-10"
    },
    md: {
      container: "w-12 h-12",
      text: "text-sm",
      tooltipOffset: "-top-12"
    },
    lg: {
      container: "w-16 h-16",
      text: "text-lg",
      tooltipOffset: "-top-14"
    }
  };

  const currentSize = sizes[size];

  // Standardized Lucide Shield Path (Classic Shield Geometry)
  const shieldPath = "M 50 92 C 50 92 83 75 83 50 V 21 L 50 8 L 17 21 V 50 C 17 75 50 92 50 92 Z";

  const tooltipText = totalUserRatings > 0 
    ? `Based on ${totalUserRatings} player reviews.`
    : "Based on game complexity stats.";

  return (
    <div 
      className={cn("relative shrink-0 cursor-help group/shield", currentSize.container, className)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={() => setShowTooltip(!showTooltip)}
    >
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, x: -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            className={cn(
              "absolute left-full ml-3 top-1/2 -translate-y-1/2 z-[100] w-max max-w-[180px] px-3 py-2 bg-charcoal border border-white/10 rounded-lg shadow-2xl pointer-events-none"
            )}
          >
            <p className="text-white text-xs font-bold text-left leading-tight whitespace-normal">
              {tooltipText}
            </p>
            {/* Tooltip Arrow (Points Left) */}
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-charcoal border-l border-b border-white/10 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Polished Metallic Shield SVG using Standardized Geometry */}
      <svg 
        viewBox="0 0 100 100" 
        className="absolute inset-0 w-full h-full drop-shadow-md transition-transform group-hover/shield:scale-110 duration-300"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#cbd5e1" /> {/* slate-300 */}
            <stop offset="50%" stopColor="#64748b" /> {/* slate-500 */}
            <stop offset="100%" stopColor="#1e293b" /> {/* slate-800 */}
          </linearGradient>
          <linearGradient id="innerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" /> {/* slate-400 */}
            <stop offset="100%" stopColor="#334155" /> {/* slate-700 */}
          </linearGradient>
        </defs>
        
        {/* Outer Border/Rim (Standardized Shape) */}
        <path 
          d={shieldPath} 
          fill="url(#shieldGradient)" 
          stroke="#0f172a" 
          strokeWidth="3"
          strokeLinejoin="round"
        />
        
        {/* Inner Shield Face (Standardized Shape) */}
        <path 
          d="M 50 86 C 50 86 77 71 77 50 V 26 L 50 15 L 23 26 V 50 C 23 71 50 86 50 86 Z" 
          fill="url(#innerGradient)" 
          stroke="rgba(255,255,255,0.1)" 
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      
      {/* DC Value Text - Optimized Alignment */}
      <div className={cn(
        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[62%] z-10 font-black text-white drop-shadow-sm tracking-tighter text-center w-full",
        currentSize.text
      )}>
        {value}
      </div>

      {/* Subtle Info Icon Cue */}
      <div className="absolute -top-1 -right-1 z-20 bg-emerald-accent rounded-full p-0.5 shadow-lg border border-charcoal opacity-0 group-hover/shield:opacity-100 transition-opacity duration-300 scale-75">
        <Info className="w-2 h-2 text-charcoal" />
      </div>
    </div>
  );
}
