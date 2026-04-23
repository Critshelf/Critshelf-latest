import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Library, 
  ChevronRight, 
  Search, 
  Filter,
  Heart,
  CheckCircle2,
  Plus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';
import GameSearchAndFilter from '../components/GameSearchAndFilter';
import GameCard, { Game } from '../components/GameCard';
import BGGImport from '../components/BGGImport';
import { Upload } from 'lucide-react';

interface CollectionItem {
  id: string;
  gameId: string;
  gameTitle: string;
  gameCover: string;
  shelf: 'owned' | 'wishlist';
}

const SHELVES = [
  { id: 'all', label: 'All Games', icon: Library, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  { id: 'owned', label: 'Owned', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  { id: 'wishlist', label: 'Wishlist', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-100' },
];

export default function Collection() {
  const { user, profile, groupRatings } = useUser();
  const [activeShelf, setActiveShelf] = useState('all');
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [gamesData, setGamesData] = useState<Record<string, Game>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [activePlayerCount, setActivePlayerCount] = useState<number | null>(null);
  const [activePlayTime, setActivePlayTime] = useState<string | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [isImportOpen, setIsImportOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const path = 'userCollections';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid),
      orderBy('addedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const collectionItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CollectionItem[];
      setItems(collectionItems);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user]);

  // Real-time hydration of game data for filtering and display
  useEffect(() => {
    if (items.length === 0) {
      setGamesData({});
      return;
    }

    const allIds = Array.from(new Set(items.map(item => item.gameId)));
    const chunks = [];
    for (let i = 0; i < allIds.length; i += 30) {
      chunks.push(allIds.slice(i, i + 30));
    }

    setLoadingMetadata(true);
    const unsubscribes: (() => void)[] = [];

    chunks.forEach(chunk => {
      const q = query(collection(db, 'games'), where('__name__', 'in', chunk));
      const unsub = onSnapshot(q, (snap) => {
        setGamesData(prev => {
          const updated = { ...prev };
          snap.docs.forEach(d => {
            updated[d.id] = { id: d.id, ...d.data() } as Game;
          });
          return updated;
        });
        setLoadingMetadata(false);
      }, (error) => {
        console.error("Error in real-time hydration:", error);
        setLoadingMetadata(false);
      });
      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(un => un());
  }, [items]);

  const availableGenres = useMemo(() => {
    const uniqueCategories = new Set<string>();
    (Object.values(gamesData) as Game[]).forEach(game => {
      game.categories?.forEach(cat => uniqueCategories.add(cat));
      game.genres?.forEach(genre => uniqueCategories.add(genre));
    });
    return Array.from(uniqueCategories).sort((a, b) => a.localeCompare(b));
  }, [gamesData]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // 1. Shelf Filter
      if (activeShelf !== 'all' && item.shelf !== activeShelf) return false;

      const game = gamesData[item.gameId];
      
      // 2. Search Filter (Can search by title even without hydrated data)
      const query = searchTerm.toLowerCase();
      const matchesTitle = item.gameTitle.toLowerCase().includes(query);
      if (query && !matchesTitle) return false;

      // The following filters require hydrated metadata
      if (!game) {
        // If we have active metadata filters but no game data, we can't match it
        if (activePlayerCount || activePlayTime || selectedGenres.length > 0) return false;
        return true;
      }

      // 3. Player Count Filter
      if (activePlayerCount) {
        const min = game.minPlayers || 0;
        const max = game.maxPlayers || 99;
        const matchesPlayers = activePlayerCount === 5 ? max >= 5 : (activePlayerCount >= min && activePlayerCount <= max);
        if (!matchesPlayers) return false;
      }

      // 4. Play Time Filter
      if (activePlayTime) {
        const time = parseInt(game.playTime || "0");
        let matchesTime = true;
        if (activePlayTime === 'quick') matchesTime = time < 30;
        else if (activePlayTime === 'standard') matchesTime = time >= 30 && time <= 90;
        else if (activePlayTime === 'epic') matchesTime = time > 90;
        if (!matchesTime) return false;
      }

      // 5. Genre Filter
      if (selectedGenres.length > 0) {
        const matchesGenre = selectedGenres.some(genre => 
          game.categories?.includes(genre) || game.genres?.includes(genre)
        );
        if (!matchesGenre) return false;
      }

      return true;
    });
  }, [items, gamesData, activeShelf, searchTerm, activePlayerCount, activePlayTime, selectedGenres]);

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <div className="w-24 h-24 bg-indigo-100 rounded-[2.5rem] flex items-center justify-center mb-6">
          <Library className="w-12 h-12 text-indigo-600" />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-4">Your Collection</h1>
        <p className="text-gray-500 font-medium mb-8 max-w-xs">Sign in to start building your digital tabletop bookshelf!</p>
        <Link 
          to="/profile"
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all"
        >
          Go to Profile
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal pb-32 md:pt-24">
      <div className="max-w-7xl mx-auto px-6 pt-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-emerald-accent rounded-2xl flex items-center justify-center shadow-lg">
                <Library className="w-6 h-6 text-charcoal" />
              </div>
              <h1 className="text-4xl font-black text-white tracking-tight">My Collection</h1>
              <button
                onClick={() => setIsImportOpen(true)}
                className="ml-4 flex items-center gap-2 bg-gold-accent text-charcoal px-4 py-2 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-gold-accent/20 group"
              >
                <Upload className="w-4 h-4 text-charcoal" />
                <span className="text-[10px] font-black uppercase tracking-widest">Import BGG</span>
              </button>
            </div>
            <p className="text-white/40 font-bold text-sm uppercase tracking-widest">
              {items.length} Games in your vault
            </p>
          </div>

          <div className="w-full overflow-hidden">
            <div className="flex flex-row flex-nowrap overflow-x-auto no-scrollbar w-[calc(100%+3rem)] -mx-6 px-6 pb-2 gap-2">
              {SHELVES.map((shelf) => (
                <button
                  key={shelf.id}
                  onClick={() => {
                    setActiveShelf(shelf.id);
                    setSearchTerm(''); // Clear search when switching shelves for better UX
                  }}
                  className={cn(
                    "flex-none flex items-center gap-2 px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all",
                    activeShelf === shelf.id 
                      ? "bg-gold-accent text-charcoal shadow-lg scale-105" 
                      : "bg-white/5 text-white/40 hover:bg-white/10"
                  )}
                >
                  <shelf.icon className={cn("w-3 h-3", activeShelf === shelf.id ? "text-charcoal" : "text-gold-accent")} />
                  {shelf.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="sticky top-20 z-40 bg-charcoal/80 backdrop-blur-xl py-4 -mx-2 px-2 mb-8">
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
            totalResults={filteredItems.length}
            resultsLabel="Collection Matches"
            placeholder="Search your collection..."
          />
        </div>

        {/* Collection Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-white/5 rounded-[2rem] animate-pulse border border-white/10 shadow-md" />
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item) => {
                const game = gamesData[item.gameId] || {
                  id: item.gameId,
                  title: item.gameTitle,
                  coverImage: item.gameCover,
                  playTime: "60"
                };

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="relative group"
                  >
                    <GameCard 
                      game={game as Game} 
                      personalRating={profile?.ratings?.[item.gameId]}
                      groupRating={groupRatings[item.gameId]?.rating}
                      groupName={groupRatings[item.gameId]?.groupName}
                    />
                    
                    {/* Shelf Status Overlay */}
                    <div className="absolute top-4 right-4 z-30 pointer-events-none">
                      <span className="text-[8px] font-black text-emerald-accent uppercase tracking-widest bg-charcoal/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-accent/20 shadow-xl group-hover:bg-emerald-accent group-hover:text-charcoal transition-all duration-300">
                        {SHELVES.find(s => s.id === item.shelf)?.label || item.shelf}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-white/5 rounded-[3rem] p-16 text-center shadow-xl border-2 border-dashed border-white/10">
            <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-white/10" />
            </div>
            {items.length > 0 ? (
              <>
                <h2 className="text-2xl font-black text-white mb-2">No matches found!</h2>
                <p className="text-white/40 font-medium mb-8">Try adjusting your filters or search query to find what you're looking for.</p>
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setActivePlayerCount(null);
                    setActivePlayTime(null);
                    setSelectedGenres([]);
                  }}
                  className="inline-flex items-center gap-2 bg-emerald-accent/10 text-emerald-accent border border-emerald-accent/20 px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-emerald-accent hover:text-charcoal transition-all"
                >
                  Clear All Filters
                </button>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-black text-white mb-2">No games found here!</h2>
                <p className="text-white/40 font-medium mb-8">Your digital shelf is looking a bit empty. Time to go hunting!</p>
                <Link 
                  to="/browse"
                  className="inline-flex items-center gap-2 bg-gold-accent text-charcoal px-8 py-4 rounded-2xl font-black shadow-lg hover:shadow-gold-accent/20 transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Discover Games
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      <BGGImport 
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />
    </div>
  );
}
