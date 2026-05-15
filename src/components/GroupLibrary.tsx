import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Library, 
  Search, 
  Filter, 
  Plus, 
  ChevronDown, 
  Dices,
  CheckCircle2,
  Megaphone,
  Users,
  Clock
} from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs,
  doc,
  getDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { cn, formatPlayTime } from '../lib/utils';
import LogPlayModal from './LogPlayModal';
import D20Die from './D20Die';
import GameTitleWithDC from './GameTitleWithDC';
import { useUser } from '../contexts/UserContext';
import GameSearchAndFilter from './GameSearchAndFilter';
import { Game } from './GameCard';
import UserAvatar from './UserAvatar';

import RequestGameModal from './RequestGameModal';

interface Member {
  uid: string;
  displayName: string;
  photoURL: string;
  avatarPreference?: 'google' | 'dicebear';
  avatarSeed?: string;
}

interface CollectionItem {
  id: string;
  userId: string;
  gameId: string;
  gameTitle: string;
  gameCover: string;
  shelf: 'owned' | 'wishlist';
}

interface GroupLibraryProps {
  groupId: string;
  members: Member[];
}

interface LibraryGame extends Partial<Game> {
  gameId: string;
  title: string;
  cover: string;
  owners: Member[];
  communityRating?: number;
}

export default function GroupLibrary({ groupId, members }: GroupLibraryProps) {
  const { user } = useUser();
  const [libraryGames, setLibraryGames] = useState<LibraryGame[]>([]);
  const [groupGameStats, setGroupGameStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOwner, setSelectedOwner] = useState<string>('all');
  
  // Advanced Filter States
  const [activePlayerCount, setActivePlayerCount] = useState<number | null>(null);
  const [activePlayTime, setActivePlayTime] = useState<string | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedGameForLog, setSelectedGameForLog] = useState<{id: string, title: string} | null>(null);
  const [selectedGameForRequest, setSelectedGameForRequest] = useState<LibraryGame | null>(null);
  const [requestingIds, setRequestingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!members.length || !user) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch Group Games Stats
        const statsSnap = await getDocs(collection(db, 'groups', groupId, 'GroupGames'));
        const stats: Record<string, any> = {};
        statsSnap.docs.forEach(d => {
          stats[d.id] = d.data();
        });
        setGroupGameStats(stats);

        // 2. Fetch Member Collections
        const memberIds = members.map(m => m.uid);
        const q = query(
          collection(db, 'userCollections'),
          where('userId', 'in', memberIds.slice(0, 30)),
          where('shelf', '==', 'owned')
        );

        const collSnap = await getDocs(q);
        const items = collSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollectionItem));
        
        const gameMap = new Map<string, LibraryGame>();

        items.forEach(item => {
          const owner = members.find(m => m.uid === item.userId);
          if (!owner) return;

          if (gameMap.has(item.gameId)) {
            const existing = gameMap.get(item.gameId)!;
            if (!existing.owners.find(o => o.uid === owner.uid)) {
              existing.owners.push(owner);
            }
          } else {
            gameMap.set(item.gameId, {
              gameId: item.gameId,
              title: item.gameTitle,
              cover: item.gameCover,
              owners: [owner],
              communityRating: (item as any).communityRating || 18
            });
          }
        });

        // Mock Data for "Friday Night Dice"
        if (groupId === 'friday_night_dice') {
          const corey = members.find(m => m.displayName.toLowerCase().includes('corey')) || members[0];
          const natasha = members.find(m => m.displayName.toLowerCase().includes('natasha')) || members[1];

          if (corey && natasha) {
            gameMap.set('loveletter', {
              gameId: 'loveletter',
              title: 'Love Letter',
              cover: 'https://images.unsplash.com/photo-1611996591156-66715960c811?auto=format&fit=crop&q=80&w=400',
              owners: [corey, natasha],
              communityRating: 19
            });
            gameMap.set('ticket-to-ride', {
              gameId: 'ticket-to-ride',
              title: 'Ticket to Ride',
              cover: 'https://images.unsplash.com/photo-1610819013583-67021be397e7?auto=format&fit=crop&q=80&w=400',
              owners: [natasha],
              communityRating: 17
            });
            gameMap.set('worker-removal-proto', {
              gameId: 'worker-removal-proto',
              title: 'Worker Removal Prototype',
              cover: 'https://images.unsplash.com/photo-1553481187-be93c21490a9?auto=format&fit=crop&q=80&w=400',
              owners: [corey],
              communityRating: 20
            });
          }
        }

        setLibraryGames(Array.from(gameMap.values()));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'GroupLibrary');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [members, groupId, user]);

  // Fetch Game Metadata for advanced filtering
  useEffect(() => {
    const fetchMetadata = async () => {
      if (libraryGames.length === 0) return;
      
      const gameIds = libraryGames.map(g => g.gameId);
      const uniqueIds = Array.from(new Set(gameIds));
      
      // Fetch details in chunks of 30 (Firestore limit)
      const detailsMap = new Map<string, any>();
      for (let i = 0; i < uniqueIds.length; i += 30) {
        const chunk = uniqueIds.slice(i, i + 30);
        const q = query(collection(db, 'games'), where('__name__', 'in', chunk));
        const snap = await getDocs(q);
        snap.docs.forEach(doc => detailsMap.set(doc.id, doc.data()));
      }

      if (detailsMap.size > 0) {
        setLibraryGames(prev => prev.map(lg => {
          const detail = detailsMap.get(lg.gameId);
          if (detail) {
            return { ...lg, ...detail };
          }
          return lg;
        }));
      }
    };

    fetchMetadata();
  }, [libraryGames.length]); // Only fetch when length changes (new unique games added)

  const availableGenres = useMemo(() => {
    const uniqueCategories = new Set<string>();
    libraryGames.forEach(game => {
      game.categories?.forEach(cat => uniqueCategories.add(cat));
      game.genres?.forEach(genre => uniqueCategories.add(genre));
    });
    return Array.from(uniqueCategories).sort((a, b) => a.localeCompare(b));
  }, [libraryGames]);

  const filteredGames = libraryGames.filter(game => {
    const query = searchQuery.toLowerCase();
    const matchesTitle = game.title.toLowerCase().includes(query);
    const matchesDesigners = game.designers?.some(d => d.toLowerCase().includes(query));
    const matchesPublishers = game.publishers?.some(p => p.toLowerCase().includes(query));
    const matchesArtists = game.artists?.some(a => a.toLowerCase().includes(query));
    const matchesSearch = !query || matchesTitle || matchesDesigners || matchesPublishers || matchesArtists;

    const matchesOwner = selectedOwner === 'all' || game.owners.some(o => o.uid === selectedOwner);

    // Player Count Filter
    let matchesPlayers = true;
    if (activePlayerCount) {
      const min = game.minPlayers || 0;
      const max = game.maxPlayers || 99;
      if (activePlayerCount === 5) {
        matchesPlayers = max >= 5;
      } else {
        matchesPlayers = activePlayerCount >= min && activePlayerCount <= max;
      }
    }

    // Play Time Filter
    let matchesTime = true;
    if (activePlayTime) {
      const timeStr = game.playTime || "0";
      const time = parseInt(timeStr);
      if (activePlayTime === 'quick') matchesTime = time < 30;
      if (activePlayTime === 'standard') matchesTime = time >= 30 && time <= 90;
      if (activePlayTime === 'epic') matchesTime = time > 90;
    }

    // Genre Filter
    let matchesGenre = true;
    if (selectedGenres.length > 0) {
      matchesGenre = selectedGenres.some(genre => 
        game.categories?.includes(genre) || game.genres?.includes(genre)
      );
    }

    return matchesSearch && matchesOwner && matchesPlayers && matchesTime && matchesGenre;
  });

  const handleLogPlay = (gameId: string, title: string) => {
    setSelectedGameForLog({ id: gameId, title });
    setIsLogModalOpen(true);
  };

  const handleRequestToPlay = (game: LibraryGame) => {
    setSelectedGameForRequest(game);
    setIsRequestModalOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Search & Advanced Filters */}
      <div className="space-y-6">
        <GameSearchAndFilter 
          searchTerm={searchQuery}
          onSearchChange={setSearchQuery}
          activePlayerCount={activePlayerCount}
          onPlayerCountChange={setActivePlayerCount}
          activePlayTime={activePlayTime}
          onPlayTimeChange={setActivePlayTime}
          selectedGenres={selectedGenres}
          onGenresChange={setSelectedGenres}
          availableGenres={availableGenres}
          totalResults={filteredGames.length}
          resultsLabel={searchQuery || activePlayerCount || activePlayTime || selectedGenres.length > 0 ? "Matches Found" : "Total Games"}
          placeholder="Search by title, designer, publisher, or artist..."
        />

        {/* Owner Dropdown Filter - Added as an extra field for Group Shelf */}
        <div className="flex justify-end">
          <div className="relative w-full sm:w-64">
            <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-accent" />
            <select
              className="w-full bg-white/5 border border-white/10 shadow-sm rounded-2xl pl-12 pr-10 py-3 font-black text-white outline-none appearance-none cursor-pointer focus:border-emerald-accent transition-all text-xs uppercase tracking-widest"
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
            >
              <option value="all" className="bg-charcoal text-white/40">Filter by Owner</option>
              {members.map(member => (
                <option key={member.uid} value={member.uid} className="bg-charcoal text-white">
                  {member.displayName}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-white/5 rounded-[2.5rem] h-64 border border-white/10 shadow-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredGames.map((game) => (
              <motion.div
                key={game.gameId}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-charcoal rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 group hover:border-emerald-accent/50 transition-all relative flex flex-col h-full"
              >
                {/* Visual Background */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <img 
                    src={game.cover || undefined} 
                    className="w-full h-full object-cover grayscale opacity-30 group-hover:scale-110 group-hover:opacity-40 transition-all duration-700 blur-[2px]" 
                    alt=""
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/60 to-transparent" />
                </div>

                <div className="relative flex flex-col flex-1 p-8 min-h-[220px]">
                  {/* Top: Ratings & Badges */}
                  <div className="flex justify-between items-start mb-auto">
                    <div className="flex flex-col gap-2">
                      {game.isApproved === false && (
                        <div className="bg-amber-500 text-white text-[7px] font-black px-2 py-1 rounded-lg uppercase tracking-widest shadow-lg flex items-center gap-1 w-fit">
                          <div className="w-1 h-1 rounded-full bg-white animate-pulse" /> Unverified
                        </div>
                      )}
                      {game.isExpansion && (
                        <div className="bg-indigo-500 text-white text-[7px] font-black px-2 py-1 rounded-lg uppercase tracking-widest shadow-lg w-fit">
                          Expansion
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      {/* Group Rating */}
                      <div className="flex flex-col items-center opacity-60 group-hover:opacity-100 transition-opacity">
                        <D20Die value={groupGameStats[game.gameId]?.average_d20 || '-'} theme="silver" size="xs" />
                        <span className="text-[6px] font-black text-white/30 uppercase tracking-widest mt-0.5">Group</span>
                      </div>
                      {/* Community Rating */}
                      <div className="flex flex-col items-center opacity-60 group-hover:opacity-100 transition-opacity">
                        <D20Die value={game.communityRating || 18} theme="emerald" size="xs" />
                        <span className="text-[6px] font-black text-white/30 uppercase tracking-widest mt-0.5">VAULT</span>
                      </div>
                    </div>
                  </div>

                  {/* Main Display */}
                  <div className="mt-auto">
                    {(game.categories?.[0] || game.genres?.[0]) && (
                      <span className="text-[10px] font-black text-emerald-accent uppercase tracking-[0.2em] mb-2 block">
                        {game.categories?.[0] || game.genres?.[0]}
                      </span>
                    )}

                    <GameTitleWithDC 
                      game={{ id: game.gameId, title: game.title, coverImage: game.cover }} 
                      shieldSize="sm" 
                      containerClassName="mb-3 w-full"
                      titleClassName="text-xl font-black text-white leading-tight group-hover:text-emerald-accent transition-colors truncate"
                    />

                    {/* Minimal Stats & Owners */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-white/40 group-hover:text-white/60 transition-colors">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
                          <Users className="w-3.5 h-3.5 opacity-50" />
                          <span>{game.minPlayers ? `${game.minPlayers}-${game.maxPlayers}` : '2-4'}</span>
                        </div>
                        {game.playTime && (
                          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
                            <Clock className="w-3.5 h-3.5 opacity-50" />
                            <span>{formatPlayTime(game.playTime)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex -space-x-2">
                        {game.owners.slice(0, 3).map((owner) => (
                          <div 
                            key={owner.uid} 
                            className="w-6 h-6 rounded-full border-2 border-charcoal shadow-sm overflow-hidden"
                            title={owner.displayName}
                          >
                            <UserAvatar user={owner} size="xs" className="w-full h-full" />
                          </div>
                        ))}
                        {game.owners.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-white/10 border-2 border-charcoal flex items-center justify-center text-[8px] font-black text-white/50">
                            +{game.owners.length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons: Visible only on hover or more subtle? */}
                <div className="relative p-6 pt-0 mt-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => handleLogPlay(game.gameId, game.title)}
                      className="bg-gold-accent text-charcoal py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:shadow-gold-accent/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Dices className="w-3.5 h-3.5" /> Log
                    </button>

                    <button 
                      onClick={() => handleRequestToPlay(game)}
                      disabled={requestingIds.has(game.gameId)}
                      className={cn(
                        "py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 border",
                        requestingIds.has(game.gameId)
                          ? "bg-emerald-accent/10 border-emerald-accent/30 text-emerald-accent"
                          : "bg-white/5 border-white/10 text-white/40 hover:border-emerald-accent/30 hover:text-emerald-accent"
                      )}
                    >
                      {requestingIds.has(game.gameId) ? "Requested" : <><Megaphone className="w-3.5 h-3.5" /> Request</>}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {filteredGames.length === 0 && !loading && (
        <div className="text-center py-20 bg-white/5 rounded-[3rem] border-2 border-dashed border-white/10">
          <Library className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <h3 className="text-xl font-black text-white mb-2">No games found</h3>
          <p className="text-white/20 font-bold">Try adjusting your search or filters.</p>
        </div>
      )}

      {selectedGameForLog && (
        <LogPlayModal
          isOpen={isLogModalOpen}
          onClose={() => {
            setIsLogModalOpen(false);
            setSelectedGameForLog(null);
          }}
          initialGame={selectedGameForLog}
          initialGroupId={groupId}
        />
      )}

      {selectedGameForRequest && (
        <RequestGameModal
          isOpen={isRequestModalOpen}
          onClose={() => {
            setIsRequestModalOpen(false);
            setSelectedGameForRequest(null);
          }}
          groupId={groupId}
          game={{
            gameId: selectedGameForRequest.gameId,
            title: selectedGameForRequest.title,
            cover: selectedGameForRequest.cover,
            owners: selectedGameForRequest.owners.map(o => ({ uid: o.uid, displayName: o.displayName }))
          }}
        />
      )}
    </div>
  );
}
