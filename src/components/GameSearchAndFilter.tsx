import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search as SearchIcon, Filter, X, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

interface GameSearchAndFilterProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  activePlayerCount: number | null;
  onPlayerCountChange: (val: number | null) => void;
  activePlayTime: string | null;
  onPlayTimeChange: (val: string | null) => void;
  selectedGenres: string[] | string; // Support both array and single string for categories
  onGenresChange: (val: string[]) => void;
  availableGenres: string[];
  totalResults: number;
  resultsLabel?: string;
  placeholder?: string;
  showAddManualLink?: boolean;
  onAddManualClick?: () => void;
}

const GameSearchAndFilter: React.FC<GameSearchAndFilterProps> = ({
  searchTerm,
  onSearchChange,
  activePlayerCount,
  onPlayerCountChange,
  activePlayTime,
  onPlayTimeChange,
  selectedGenres,
  onGenresChange,
  availableGenres,
  totalResults,
  resultsLabel = "Matches Found",
  placeholder = "Search by title, designer, or publisher...",
  showAddManualLink = false,
  onAddManualClick
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Normalize selectedGenres to array
  const activeGenres = Array.isArray(selectedGenres) ? selectedGenres : (selectedGenres ? [selectedGenres] : []);

  const hasActiveFilters = activePlayerCount !== null || activePlayTime !== null || activeGenres.length > 0;

  const clearFilters = () => {
    onPlayerCountChange(null);
    onPlayTimeChange(null);
    onGenresChange([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <SearchIcon className="w-6 h-6 text-white/20" />
          </div>
          <input
            type="text"
            placeholder={placeholder}
            className="w-full bg-white/5 border-2 border-white/10 rounded-[2.5rem] py-6 pl-16 pr-16 focus:border-emerald-accent outline-none shadow-2xl text-xl font-bold text-white placeholder:text-white/20 transition-all"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <AnimatePresence>
            {searchTerm && (
              <motion.button 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 right-6 flex items-center text-white/20 hover:text-rose-500 transition-colors"
              >
                <X className="w-8 h-8" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        
        <button 
          onClick={() => setIsFilterOpen(true)}
          className={cn(
            "w-20 h-20 rounded-[2rem] flex items-center justify-center border-2 transition-all relative shrink-0",
            hasActiveFilters 
              ? "bg-emerald-accent/10 border-emerald-accent text-emerald-accent shadow-[0_0_20px_rgba(16,185,129,0.2)]" 
              : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
          )}
        >
          <Filter className="w-8 h-8" />
          {hasActiveFilters && (
            <span className="absolute top-5 right-5 w-3 h-3 bg-emerald-accent rounded-full border-2 border-charcoal" />
          )}
        </button>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <span className="bg-emerald-accent text-charcoal px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest">
            {totalResults}
          </span>
          <span className="text-sm font-black text-white/40 uppercase tracking-widest">
            {resultsLabel}
          </span>
        </div>

        {showAddManualLink && (
          <button 
            onClick={onAddManualClick}
            className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] hover:text-emerald-accent transition-colors flex items-center gap-2"
          >
            <X className="w-3 h-3 rotate-45" />
            Can't find a game? Add it manually
          </button>
        )}
      </div>

      {/* Advanced Filter Bottom Sheet */}
      <AnimatePresence>
        {isFilterOpen && (
          <div className="fixed inset-0 z-[10000] flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl bg-charcoal rounded-t-[3rem] border-t border-white/10 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="px-8 pt-6 pb-4 bg-charcoal z-10 border-b border-white/5">
                <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black text-white tracking-tight">Advanced Filters</h2>
                  <button onClick={() => setIsFilterOpen(false)} className="p-2 bg-white/5 rounded-xl text-white/40 hover:text-white transition-all">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10 custom-scrollbar">
                {/* Player Count */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Player Count</h3>
                  <div className="flex flex-wrap gap-3">
                    {[1, 2, 3, 4, 5].map(count => (
                      <button
                        key={count}
                        onClick={() => onPlayerCountChange(activePlayerCount === count ? null : count)}
                        className={cn(
                          "w-12 h-12 rounded-2xl font-black text-sm transition-all border-2",
                          activePlayerCount === count 
                            ? "bg-emerald-accent border-transparent text-charcoal shadow-lg" 
                            : "bg-white/5 border-white/5 text-white/40 hover:border-white/10"
                        )}
                      >
                        {count}{count === 5 ? '+' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Play Time */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Play Time</h3>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { id: 'quick', label: 'Quick (< 30m)' },
                      { id: 'standard', label: 'Standard (30-90m)' },
                      { id: 'epic', label: 'Epic (90m+)' }
                    ].map(time => (
                      <button
                        key={time.id}
                        onClick={() => onPlayTimeChange(activePlayTime === time.id ? null : time.id)}
                        className={cn(
                          "px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border-2",
                          activePlayTime === time.id 
                            ? "bg-emerald-accent border-transparent text-charcoal shadow-lg" 
                            : "bg-white/5 border-white/5 text-white/40 hover:border-white/10"
                        )}
                      >
                        {time.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Theme / Category Dropdown */}
                <div className="space-y-4 pb-8">
                  <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Theme / Category</h3>
                  <div className="relative">
                    <select
                      className="w-full bg-white/5 border-2 border-white/10 rounded-2xl py-4 px-6 text-white font-bold appearance-none outline-none focus:border-emerald-accent transition-all cursor-pointer"
                      value={activeGenres[0] || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        onGenresChange(val ? [val] : []);
                      }}
                    >
                      <option value="" className="bg-charcoal text-white/40">All Categories</option>
                      {availableGenres.map(genre => (
                        <option key={genre} value={genre} className="bg-charcoal text-white">
                          {genre}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-6 flex items-center pointer-events-none">
                      <ChevronDown className="w-5 h-5 text-white/20" />
                    </div>
                  </div>
                  
                  {/* Selected Genre Tag */}
                  {activeGenres.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {activeGenres.map(genre => (
                        <div key={genre} className="bg-emerald-accent/10 border border-emerald-accent text-emerald-accent px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                          {genre}
                          <button onClick={() => onGenresChange([])}>
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-8 py-6 bg-charcoal border-t border-white/5 flex items-center gap-6">
                <button 
                  onClick={clearFilters}
                  className="text-xs font-black text-white/40 uppercase tracking-widest hover:text-rose-500 transition-colors"
                >
                  Clear All
                </button>
                <button 
                  onClick={() => setIsFilterOpen(false)}
                  className="flex-1 bg-gold-accent text-charcoal py-5 rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-xl hover:shadow-gold-accent/20 transition-all active:scale-95"
                >
                  Show Games
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GameSearchAndFilter;
