import React from 'react';
import { Swords } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface ACBadgeProps {
  value: number | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function ACBadge({ value, size = 'sm', className }: ACBadgeProps) {
  const displayValue = value ?? 0;

  const sizes = {
    sm: {
      container: "h-6 px-2 gap-1 rounded-lg",
      icon: "w-3 h-3",
      text: "text-[10px]"
    },
    md: {
      container: "h-8 px-3 gap-1.5 rounded-xl",
      icon: "w-4 h-4",
      text: "text-xs"
    },
    lg: {
      container: "h-10 px-4 gap-2 rounded-2xl",
      icon: "w-5 h-5",
      text: "text-sm"
    }
  };

  const currentSize = sizes[size];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex items-center justify-center bg-gradient-to-br from-rose-900 to-black border border-rose-500/30 shadow-lg shadow-rose-900/20",
        currentSize.container,
        className
      )}
      title="Attack Class: Average game difficulty (Last 12 months)"
    >
      <Swords className={cn("text-rose-500", currentSize.icon)} />
      <span className={cn("font-black text-white", currentSize.text)}>
        {displayValue}
      </span>
    </motion.div>
  );
}
