import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface D20DieProps {
  value: number | string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'emerald' | 'gold' | 'silver' | 'outline';
  className?: string;
}

export default function D20Die({ value, size = 'md', theme = 'emerald', className }: D20DieProps) {
  // Ensure value is rounded if it's numeric/parseable as a number
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  const displayValue = isNaN(numericValue as number) ? value : Math.round(numericValue as number);
  
  const isNat20 = displayValue === 20 || displayValue === '20';
  
  const sizeClasses = {
    xs: 'w-9 h-9 text-[24px]',
    sm: 'w-11 h-11 text-[28px]',
    md: 'w-16 h-16 text-[40px]',
    lg: 'w-24 h-24 text-[64px]',
    xl: 'w-36 h-36 text-[94px]'
  };

  const themes = {
    emerald: {
      stop1: '#10b981',
      stop2: '#064e3b',
      stroke: '#064e3b',
      text: 'white',
      fill: '#10b981',
      opacity: 0.3
    },
    gold: {
      stop1: '#fbbf24',
      stop2: '#92400e',
      stroke: '#92400e',
      text: 'white',
      fill: '#fbbf24',
      opacity: 0.3
    },
    silver: {
      stop1: '#94a3b8',
      stop2: '#334155',
      stroke: '#334155',
      text: 'white',
      fill: '#94a3b8',
      opacity: 0.3
    },
    outline: {
      stop1: 'transparent',
      stop2: 'transparent',
      stroke: '#ffffff20',
      text: '#ffffff40',
      fill: 'transparent',
      opacity: 0
    }
  };

  const currentTheme = themes[theme];

  return (
    <div className={cn(
      "relative flex items-center justify-center",
      sizeClasses[size],
      isNat20 && theme === 'emerald' && "nat-20-glow",
      className
    )}>
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-xl"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`dieGradient-${theme}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={currentTheme.stop1} />
            <stop offset="100%" stopColor={currentTheme.stop2} />
          </linearGradient>
          <filter id="innerShadow">
            <feOffset dx="2" dy="2" />
            <feGaussianBlur stdDeviation="3" result="offset-blur" />
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
            <feFlood floodColor="black" floodOpacity="0.5" result="color" />
            <feComposite operator="in" in="color" in2="inverse" result="shadow" />
            <feComposite operator="over" in="shadow" in2="SourceGraphic" />
          </filter>
        </defs>
        
        {/* Main Hexagon Shape for 3D effect */}
        <path
          d="M50 5 L90 25 L90 75 L50 95 L10 75 L10 25 Z"
          fill={theme === 'outline' ? 'none' : `url(#dieGradient-${theme})`}
          stroke={currentTheme.stroke}
          strokeWidth="2"
          filter={theme === 'outline' ? 'none' : "url(#innerShadow)"}
        />
        
        {/* Face Lines for 3D structure */}
        {theme !== 'outline' && (
          <>
            <path d="M50 5 L50 40" stroke="#ffffff20" strokeWidth="1" />
            <path d="M10 25 L50 40" stroke="#ffffff20" strokeWidth="1" />
            <path d="M90 25 L50 40" stroke="#ffffff20" strokeWidth="1" />
            
            <path d="M50 95 L50 60" stroke="#00000030" strokeWidth="1" />
            <path d="M10 75 L50 60" stroke="#00000030" strokeWidth="1" />
            <path d="M90 75 L50 60" stroke="#00000030" strokeWidth="1" />
          </>
        )}
        
        {/* The Number */}
        <text
          x="50"
          y="53"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={isNat20 && theme === 'emerald' ? "#fbbf24" : currentTheme.text}
          className="font-black leading-none"
          style={{ 
            fontSize: 'inherit',
            filter: isNat20 && theme === 'emerald' ? 'drop-shadow(0 0 2px rgba(251, 191, 36, 0.8))' : 'none'
          }}
        >
          {displayValue}
        </text>
      </svg>
      
      {/* Subtle Sparks for Nat 20 */}
      {isNat20 && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: [0, 1, 0], 
                opacity: [0, 1, 0],
                x: (Math.random() - 0.5) * 40,
                y: (Math.random() - 0.5) * 40
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity, 
                delay: i * 0.2,
                ease: "easeOut"
              }}
              className="absolute top-1/2 left-1/2 w-1 h-1 bg-gold-accent rounded-full"
            />
          ))}
        </div>
      )}
    </div>
  );
}
