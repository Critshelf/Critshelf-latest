import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Users, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import D20Die from './D20Die';
import GameTitleWithDC from './GameTitleWithDC';
import { cn, formatPlayTime } from '../lib/utils';

export interface Game {
  id: string;
  title: string;
  coverImage: string;
  bannerImage?: string;
  bannerStyles?: {
    filter: string;
    opacity: number;
    transform: string;
  };
  playTime?: string | number | null;
  minPlayers?: number;
  maxPlayers?: number;
  playerCount?: string;
  publisher?: string;
  ageRange?: string;
  description?: string;
  trending?: boolean;
  hasHighResArt?: boolean;
  rating?: number;
  bggId?: string;
  publishingYear?: number | string;
  publishers?: string[];
  designers?: string[];
  artists?: string[];
  genres?: string[];
  categories?: string[];
  baseGameId?: string;
  isExpansion?: boolean;
  isWikidataItem?: boolean;
  expansions?: {
    id: string;
    title: string;
    boxArtUrl: string;
    bggId?: string;
  }[];
  editions?: {
    id: string;
    title: string;
    publisher: string;
    yearPublished: number;
    boxArtUrl: string;
  }[];
}

interface GameCardProps {
  game: Game;
  compact?: boolean;
  personalRating?: number | string;
  groupRating?: number | string;
  groupName?: string;
  onClick?: (e: React.MouseEvent) => void;
}

const GameCard: React.FC<GameCardProps> = ({ 
  game, 
  compact = false, 
  personalRating,
  groupRating,
  groupName,
  onClick
}) => {
  // Social Rating Logic - strictly based on game data or props if available
  const communityRating = game.rating;
  const displayPersonal = personalRating || (game as any).personalRating;
  const displayGroup = groupRating || (game as any).groupRating;
  const activeGroupName = groupName || (game as any).groupName;

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      onClick={onClick}
      className="group relative bg-charcoal rounded-[2rem] shadow-2xl overflow-hidden transition-all duration-300 hover:shadow-emerald-accent/20 border border-white/10 hover:border-emerald-accent/50 h-full flex flex-col"
    >
      <Link 
        to={`/game/${game.id}`} 
        className="flex flex-col flex-1 w-full min-h-[12rem] relative"
        onClick={onClick ? (e) => e.preventDefault() : undefined}
      >
        {/* Vibe Blur Background */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={game.bannerImage || game.coverImage || undefined}
            alt=""
            className={cn(
              "w-full h-full object-cover transition-transform duration-700 group-hover:scale-125",
              game.hasHighResArt 
                ? "opacity-100 filter-none brightness-100 grayscale-0" 
                : (!game.bannerImage ? "blur-[8px] opacity-40 grayscale brightness-75" : "opacity-50 grayscale brightness-75")
            )}
            style={game.bannerImage ? game.bannerStyles : undefined}
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        </div>
        
        {/* Gradient Overlay */}
        <div className={cn(
          "absolute inset-0 transition-opacity duration-500",
          game.hasHighResArt 
            ? "bg-gradient-to-r from-charcoal/80 via-charcoal/40 to-transparent" 
            : "bg-gradient-to-r from-charcoal via-charcoal/90 to-transparent"
        )} />
        
        {/* Content */}
        <div className={cn(
          "relative flex items-center justify-between gap-2 h-full flex-1",
          compact ? "p-4" : "p-6"
        )}>
          {/* Rating Display */}
          <div className={cn(
            "flex flex-col items-center gap-2 shrink-0 self-center",
            compact ? "min-w-[50px]" : "min-w-[70px]"
          )}>
            {/* Primary Display: Personal > Group > Community */}
            {displayPersonal && displayPersonal !== '-' ? (
              <div className="flex flex-col items-center">
                <D20Die 
                  value={displayPersonal} 
                  theme="gold" 
                  size={compact ? "xs" : "sm"} 
                />
                <span className="text-[7px] font-black text-gold-accent uppercase tracking-widest mt-0.5">
                  You
                </span>
              </div>
            ) : displayGroup && displayGroup !== '-' ? (
              <div className="flex flex-col items-center">
                <D20Die 
                  value={displayGroup} 
                  theme="silver" 
                  size={compact ? "xs" : "sm"} 
                />
                <span className="text-[6px] font-black text-white/50 uppercase tracking-tighter mt-0.5 max-w-[50px] truncate text-center">
                  {activeGroupName || 'Group'}
                </span>
              </div>
            ) : null}

            {/* Community Rating Sub-display */}
            <div className="flex flex-col items-center">
              <D20Die 
                value={communityRating || '-'} 
                theme={communityRating ? "emerald" : "outline"} 
                size={compact ? (displayPersonal || displayGroup ? "xs" : "sm") : "md"} 
              />
              <span className="text-[8px] font-black text-white/30 uppercase tracking-widest mt-0.5">
                {communityRating ? 'Rating' : 'Unrated'}
              </span>
            </div>
          </div>

          {/* Center Content */}
          <div className="flex flex-col justify-center items-center text-center flex-1 min-w-0 px-2 h-full">
            <div className="flex-1 flex flex-col justify-center w-full">
              <GameTitleWithDC 
                game={game} 
                shieldSize="sm" 
                shouldTruncate={true}
                containerClassName={cn("justify-center w-full", compact ? "mb-1" : "mb-3")}
                titleClassName={cn(
                  "text-white group-hover:text-emerald-accent transition-colors",
                  compact ? "text-sm sm:text-base line-clamp-2" : "text-xl md:text-2xl"
                )}
              />
            </div>
            
            {/* Stats Row */}
            {!compact && (
              <div className="max-w-full flex items-center gap-2 bg-white/5 backdrop-blur-md px-3 py-2 rounded-full border border-white/10 overflow-hidden mt-auto">
                {game.categories && game.categories.length > 0 && (
                  <>
                    <span className="text-[9px] font-black text-emerald-accent uppercase tracking-widest truncate">
                      {game.categories[0]}
                    </span>
                    <div className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                  </>
                )}
                <div className="flex items-center gap-1.5 text-white/60 text-[9px] font-black uppercase tracking-widest shrink-0">
                  <Users className="w-3 h-3 text-white/40" />
                  <span>{game.playerCount || '2-4'}</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                <div className="flex items-center gap-1.5 text-white/60 text-[9px] font-black uppercase tracking-widest shrink-0">
                  <Clock className="w-3 h-3 text-white/40" />
                  <span>{formatPlayTime(game.playTime)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Right Side Empty spacer to maintain centering */}
          <div className={cn(
            "shrink-0",
            compact ? "w-[50px]" : "w-[70px]"
          )} />
        </div>

        {/* DC Shield Badge (REMOVED FROM HERE) */}

        {/* Trending Badge */}
        {game.trending && (
          <div className="absolute top-4 left-4 bg-emerald-accent text-charcoal text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg z-20 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Trending
          </div>
        )}

        {/* Unverified Badge */}
        {game.isApproved === false && (
          <div className={cn(
            "absolute top-4 bg-amber-500 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg z-20 flex items-center gap-1",
            game.trending ? "left-24" : "left-4"
          )}>
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Unverified
          </div>
        )}
        
        {/* Hover Arrow */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-300">
          <div className="bg-emerald-accent text-charcoal p-2 rounded-xl shadow-lg">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default GameCard;
