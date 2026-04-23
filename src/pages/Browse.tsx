import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Search as SearchIcon, Plus, ChevronDown } from 'lucide-react';
import GameCard, { Game } from '../components/GameCard';
import AddGameModal from '../components/AddGameModal';
import GameSearchAndFilter from '../components/GameSearchAndFilter';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, getDocs, query, limit, doc, orderBy, startAfter, getCountFromServer, where, onSnapshot } from 'firebase/firestore';
import { useUser } from '../contexts/UserContext';

import { MOCK_GAMES } from '../constants';

export default function Browse() {
  const { profile, groupRatings } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filter States
  const [activePlayerCount, setActivePlayerCount] = useState<number | null>(null);
  const [activePlayTime, setActivePlayTime] = useState<string | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  const PAGE_SIZE = 20;

  const fetchTotalCount = async () => {
    try {
      const coll = collection(db, 'games');
      const snapshot = await getCountFromServer(coll);
      setTotalCount(snapshot.data().count);
    } catch (error) {
      console.error("Error fetching count:", error);
    }
  };

  const fetchMoreGames = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);

    const path = 'games';
    try {
      const q = query(
        collection(db, path),
        where('isApproved', '==', true),
        orderBy('title'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const gameList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
      setGames(prev => [...prev, ...gameList]);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchTotalCount();

    const q = query(
      collection(db, 'games'), 
      where('isApproved', '==', true),
      orderBy('title'), 
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gameList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      setGames(gameList);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'games');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const availableGenres = useMemo(() => {
    const uniqueCategories = new Set<string>();
    games.forEach(game => {
      // Use both categories (patched) and genres (original) for maximum coverage
      game.categories?.forEach(cat => uniqueCategories.add(cat));
      game.genres?.forEach(genre => uniqueCategories.add(genre));
    });
    return Array.from(uniqueCategories).sort((a, b) => a.localeCompare(b));
  }, [games]);

  const filteredGames = games.filter(game => {
    const query = searchTerm.toLowerCase();
    const matchesTitle = game.title.toLowerCase().includes(query);
    const matchesDesigners = game.designers?.some(d => d.toLowerCase().includes(query));
    const matchesPublishers = game.publishers?.some(p => p.toLowerCase().includes(query));
    const matchesSearch = matchesTitle || matchesDesigners || matchesPublishers;

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

    // Genre/Category Filter (Multi-select: Match ANY of selected)
    let matchesGenre = true;
    if (selectedGenres.length > 0) {
      matchesGenre = selectedGenres.some(genre => 
        game.categories?.includes(genre) || game.genres?.includes(genre)
      );
    }

    return matchesSearch && matchesPlayers && matchesTime && matchesGenre;
  });

  const hasActiveFilters = activePlayerCount !== null || activePlayTime !== null || selectedGenres.length > 0;

  const clearFilters = () => {
    setActivePlayerCount(null);
    setActivePlayTime(null);
    setSelectedGenres([]);
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre) 
        : [...prev, genre]
    );
  };

  return (
    <div className="min-h-screen bg-charcoal pb-32 md:pt-24">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-emerald-accent/10 rounded-[2rem] flex items-center justify-center shadow-inner border border-emerald-accent/20">
              <SearchIcon className="w-10 h-10 text-emerald-accent" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight">Find a Game</h1>
              <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Find games, designers, or publishers</p>
            </div>
          </div>
        </div>

        <GameSearchAndFilter 
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          activePlayerCount={activePlayerCount}
          onPlayerCountChange={setActivePlayerCount}
          activePlayTime={activePlayTime}
          onPlayTimeChange={setActivePlayTime}
          selectedGenres={selectedGenres}
          onGenresChange={setSelectedGenres}
          availableGenres={availableGenres}
          totalResults={searchTerm || hasActiveFilters ? filteredGames.length : totalCount}
          resultsLabel={searchTerm || hasActiveFilters ? 'Matches Found' : 'Total Games'}
          showAddManualLink={true}
          onAddManualClick={() => setIsAddModalOpen(true)}
        />

        {/* Results Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse bg-white/5 rounded-[2rem] h-48 border border-white/10 shadow-lg" />
            ))}
          </div>
        ) : (
          <>
            {filteredGames.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                  {filteredGames.map(game => (
                    <GameCard 
                      key={game.id} 
                      game={game} 
                      personalRating={profile?.ratings?.[game.id]}
                      groupRating={groupRatings[game.id]?.rating}
                      groupName={groupRatings[game.id]?.groupName}
                    />
                  ))}
                </div>

                {hasMore && !searchTerm && (
                  <div className="mt-16 flex justify-center">
                    <button
                      onClick={() => fetchMoreGames()}
                      disabled={loadingMore}
                      className="flex items-center gap-3 bg-white/5 text-white px-10 py-5 rounded-[2rem] font-black shadow-xl hover:bg-white/10 transition-all disabled:opacity-50 border border-white/10 active:scale-95"
                    >
                      {loadingMore ? (
                        <div className="w-5 h-5 border-3 border-emerald-accent border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ChevronDown className="w-6 h-6" />
                      )}
                      {loadingMore ? 'Loading More...' : 'Show More Games'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-32 bg-white/5 rounded-[3rem] border-2 border-dashed border-white/10"
              >
                <div className="bg-white/5 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                  <SearchIcon className="w-12 h-12 text-white/10" />
                </div>
                <h3 className="text-3xl font-black text-white mb-2 tracking-tight">Game Not Found!</h3>
                <p className="text-white/40 font-bold mb-8">We couldn't find "{searchTerm}" in our library.</p>
                
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-emerald-accent text-charcoal px-10 py-5 rounded-2xl font-black text-lg shadow-lg hover:shadow-emerald-accent/20 transition-all inline-flex items-center gap-3"
                >
                  <Plus className="w-6 h-6" />
                  Add it to the Database
                </button>
              </motion.div>
            )}
          </>
        )}
      </div>

      <AddGameModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        initialTitle={searchTerm}
      />
    </div>
  );
}
