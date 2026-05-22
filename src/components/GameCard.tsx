import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Users, Clock, TrendingUp, ArrowRight, Activity } from 'lucide-react';
import D20Die from './D20Die';
import GameTitleWithDC from './GameTitleWithDC';
import { cn, formatPlayTime } from '../lib/utils';

export interface Game {
  id: string;
  title: string;
  coverImage?: string;
  thumbnail?: string;
  bannerImage?: string;
  playTime?: string | number | null;
  minPlayers?: number;
  maxPlayers?: number;
  playerCount?: string;
  publisher?: string;
  publishers?: string[];
  ageRange?: string;
  description?: string;
  trending?: boolean;
  hasHighResArt?: boolean;
  customImageApproved?: boolean;
  rating?: number;
  bggId?: string;
  publishingYear?: number | string;
  designers?: string[];
  artists?: string[];
  genres?: string[];
  categories?: string[];
  baseGameId?: string;
  isExpansion?: boolean;
  isWikidataItem?: boolean;
  isApproved?: boolean;
  needsVerification?: boolean;
  bannerStyles?: {
    filter: string;
    opacity: number;
    transform: string;
  };
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
  isRecentPlay?: boolean;
  playCount?: number;
  onClick?: (e: React.MouseEvent) => void;
}

const GameCard: React.FC<GameCardProps> = ({ 
  game, 
  compact = false, 
  personalRating,
  groupRating,
  groupName,
  isRecentPlay,
  playCount,
  onClick
}) => {
  const [imgError, setImgError] = useState(false);

  // Social Rating Logic - strictly based on game data or props if available
  const communityRating = game.rating;
  const displayPersonal = personalRating || (game as any).personalRating;
  const displayGroup = groupRating || (game as any).groupRating;
  const activeGroupName = groupName || (game as any).groupName;

  const resolvedImage = game.coverImage;

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      onClick={onClick}
      className="group relative bg-charcoal rounded-[2rem] shadow-2xl overflow-hidden transition-all duration-300 hover:shadow-emerald-accent/20 border border-white/10 hover:border-emerald-accent/50 h-full flex flex-col"
    >
      <Link 
        to={`/game/${game.id}`} 
        className="flex flex-col flex-1 w-full relative"
        onClick={onClick ? (e) => e.preventDefault() : undefined}
      >
        {/* Background Image */}
        <div className="absolute inset-0 overflow-hidden bg-charcoal flex items-center justify-center">
          {(!imgError && resolvedImage) ? (
            <img
              src={resolvedImage}
              alt={game.title}
              className={cn(
                "w-full h-full object-cover transition-transform duration-700 group-hover:scale-110",
                game.customImageApproved
                  ? "opacity-100 filter-none brightness-100 grayscale-0"
                  : "opacity-40 blur-md grayscale brightness-50"
              )}
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={(e) => { 
                // Only hide if it truly errors so we don't aggressively replace valid ones
                e.currentTarget.style.display = 'none'; 
                setImgError(true);
              }}
            />
          ) : (
            <div className="w-full h-full bg-white/5 flex items-center justify-center relative">
              <span className="text-white/20 font-black tracking-widest uppercase text-xs z-10">No Art Available</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent z-10 pointer-events-none" />
        </div>
        
        {/* Content */}
        <div className={cn(
          "relative flex flex-col justify-end p-6 min-h-[220px] h-full z-20",
          compact && "p-4 min-h-[180px]"
        )}>
          {isRecentPlay && playCount !== undefined && (
            <div className="absolute top-2 left-2 bg-emerald-accent/20 border border-emerald-accent text-emerald-accent text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest flex items-center gap-1.5 w-fit shadow-[0_0_15px_rgba(45,212,191,0.2)] backdrop-blur-md z-30 pointer-events-auto">
              <Activity className="w-3 h-3" />
              {playCount} {playCount === 1 ? 'Play' : 'Plays'}
            </div>
          )}

          {/* Top Badges */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20 pointer-events-none">
            <div className="flex flex-col gap-2 pointer-events-auto">
              {!isRecentPlay && playCount !== undefined && (
                <div className="bg-emerald-accent/20 border border-emerald-accent text-emerald-accent text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest flex items-center gap-1.5 w-fit shadow-[0_0_15px_rgba(45,212,191,0.2)] backdrop-blur-md">
                  <Activity className="w-3 h-3" />
                  {playCount} {playCount === 1 ? 'Play' : 'Plays'}
                </div>
              )}
              {game.trending && (
                <div className="bg-emerald-accent text-charcoal text-[7px] font-black px-2 py-1 rounded-lg uppercase tracking-widest shadow-lg flex items-center gap-1 w-fit">
                  <TrendingUp className="w-2.5 h-2.5" /> Trending
                </div>
              )}
              {game.isApproved === false && (
                <div className="bg-amber-500 text-white text-[7px] font-black px-2 py-1 rounded-lg uppercase tracking-widest shadow-lg flex items-center gap-1 w-fit">
                  <div className="w-1 h-1 rounded-full bg-white animate-pulse" /> Unverified
                </div>
              )}
              {game.isExpansion && (
                <div className="bg-indigo-500 text-white text-[7px] font-black px-2 py-1 rounded-lg uppercase tracking-widest shadow-lg flex items-center gap-1 w-fit">
                  Expansion
                </div>
              )}
            </div>

            {/* Rating Die in corner */}
            {(displayPersonal && displayPersonal !== '-' || communityRating) ? (
              <div className="flex flex-col items-end gap-2 bg-black/60 backdrop-blur-md px-2 py-2 rounded-xl shadow-xl border border-white/10 pointer-events-auto transition-transform hover:scale-105">
                {displayPersonal && displayPersonal !== '-' && (
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] font-black text-gold-accent uppercase tracking-widest mb-1">You</span>
                    <D20Die value={displayPersonal} theme="gold" size="sm" />
                  </div>
                )}
                {communityRating && (
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] font-black text-emerald-accent uppercase tracking-widest mb-1">Avg</span>
                    <D20Die value={communityRating} theme="emerald" size="sm" />
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Main Info */}
          <div className="mt-auto">
            {game.categories && game.categories.length > 0 && (
              <span className="text-[10px] font-black text-emerald-accent uppercase tracking-[0.2em] mb-2 block">
                {game.categories[0]}
              </span>
            )}
            
            <GameTitleWithDC 
              game={game} 
              shieldSize="sm" 
              shouldTruncate={true}
              containerClassName="mb-1"
              titleClassName={cn(
                "text-white group-hover:text-emerald-accent transition-colors",
                compact ? "text-base sm:text-lg" : "text-xl md:text-2xl"
              )}
            />

            {/* Stats Row */}
            <div className="flex items-center gap-4 text-white/40 group-hover:text-white/60 transition-colors">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
                <Users className="w-3.5 h-3.5 opacity-50" />
                <span>{game.playerCount || (game.minPlayers ? `${game.minPlayers}-${game.maxPlayers}` : '2-4')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
                <Clock className="w-3.5 h-3.5 opacity-50" />
                <span>{formatPlayTime(game.playTime)}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Hover Arrow Overlay */}
        <div className="absolute right-6 bottom-6 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
          <div className="bg-emerald-accent text-charcoal p-2.5 rounded-xl shadow-[0_0_20px_rgba(45,212,191,0.4)]">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default GameCard;
