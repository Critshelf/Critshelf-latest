import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search as SearchIcon,
  Plus,
  ChevronDown,
  Loader2,
  Globe,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import GameCard, { Game } from "../components/GameCard";
import AddGameModal from "../components/AddGameModal";
import GameSearchAndFilter from "../components/GameSearchAndFilter";
import { db, OperationType, handleFirestoreError } from "../lib/firebase";
import {
  collection,
  getDocs,
  query,
  limit,
  doc,
  orderBy,
  startAfter,
  getCountFromServer,
  where,
  onSnapshot,
  documentId,
} from "firebase/firestore";
import { useUser } from "../contexts/UserContext";
import { searchWikidata } from "../services/wikidataService";
import { BOARD_GAME_CATEGORIES } from "../constants";

export default function Browse() {
  const { profile, groupRatings, friendsRatings } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Wikidata Search State
  const [wikidataResults, setWikidataResults] = useState<Game[]>([]);
  const [wikidataLoading, setWikidataLoading] = useState(false);
  const [jitLoadingId, setJitLoadingId] = useState<string | null>(null);

  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const navigate = useNavigate();
  const [activePlayerCount, setActivePlayerCount] = useState<number | null>(
    null,
  );
  const [activePlayTime, setActivePlayTime] = useState<string | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  const PAGE_SIZE = 20;

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [currentLevel, setCurrentLevel] = useState(1);

  // Total count
  useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        const snapshot = await getCountFromServer(collection(db, "games"));
        setTotalCount(snapshot.data().count);
        setQuotaExceeded(false);
      } catch (error: any) {
        if (error.code === "resource-exhausted") {
          setQuotaExceeded(true);
        }
        console.error("Error fetching count:", error);
      }
    };
    fetchTotalCount();
  }, []);

  const buildBaseQuery = (level: number) => {
    let q = query(collection(db, "games"));

    if (selectedGenres.length > 0) {
      // Use the first selected genre for server-side filtering
      q = query(q, where("categories", "array-contains", selectedGenres[0]));
    }

    if (debouncedSearch) {
      const queryTerm = debouncedSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      q = query(
        q,
        where("name_lowercase", ">=", queryTerm),
        where("name_lowercase", "<=", queryTerm + "\uf8ff"),
        orderBy("name_lowercase"),
      );
    } else {
      q = query(q, orderBy("title"));
    }

    return q;
  };

  useEffect(() => {
    setLoading(true);
    setQuotaExceeded(false);
    let unsubscribe: (() => void) | undefined;

    const startSearch = async (level: number) => {
      try {
        setCurrentLevel(level);
        const q = buildBaseQuery(level);
        const limitedQ = query(q, limit(PAGE_SIZE));

        const snapshot = await getDocs(limitedQ);
        const gameList = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            coverImage: data.coverImage || data.thumbnail || "",
            customImageApproved:
              data.customImageApproved || data.isApproved || false,
          } as unknown as Game;
        });

        setGames(gameList);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
        setLoading(false);
        setQuotaExceeded(false);
      } catch (error: any) {
        if (error.code === "resource-exhausted") {
          console.error("Firestore quota exceeded in Browse.");
          setQuotaExceeded(true);
        } else {
          console.error("Critical search error:", error);
        }
        setLoading(false);
      }
    };

    startSearch(1);

    return () => {};
  }, [debouncedSearch, activePlayerCount, JSON.stringify(selectedGenres)]);

  const fetchMoreGames = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);

    try {
      const q = query(
        buildBaseQuery(currentLevel),
        startAfter(lastDoc),
        limit(PAGE_SIZE),
      );

      const snapshot = await getDocs(q);
      const gameList = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          coverImage: data.coverImage || data.thumbnail || "",
          customImageApproved:
            data.customImageApproved || data.isApproved || false,
        } as unknown as Game;
      });

      if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
        setGames((prev) => [...prev, ...gameList]);
      } else {
        setHasMore(false);
      }
      setQuotaExceeded(false);
    } catch (error: any) {
      if (error.code === "resource-exhausted") {
        setQuotaExceeded(true);
      }
      console.warn("fetchMoreGames failed:", error.message);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  // Wikidata Search Effect
  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 3) {
      setWikidataResults([]);
      return;
    }

    setWikidataLoading(true);
    searchWikidata(debouncedSearch)
      .then(async (results) => {
        // Query local Firestore for these Wikidata IDs to merge coverImage
        const wikidataLocalIds = results.map((r) => `wikidata_${r.id}`);
        const localGamesMap = new Map<string, any>();

        if (wikidataLocalIds.length > 0) {
          try {
            const chunkSize = 10;
            for (let i = 0; i < wikidataLocalIds.length; i += chunkSize) {
              const chunk = wikidataLocalIds.slice(i, i + chunkSize);
              // using documentId() to match doc IDs
              const localQ = query(
                collection(db, "games"),
                where(documentId(), "in", chunk),
              );
              const snap = await getDocs(localQ);
              snap.docs.forEach((d) => localGamesMap.set(d.id, d.data()));
            }
          } catch (error) {
            console.error("Local merge failed for wikidata results:", error);
          }
        }

        const mapped = results.map((res) => {
          const localId = `wikidata_${res.id}`;
          const localData = localGamesMap.get(localId);
          const localCover = localData?.coverImage || localData?.thumbnail;
          const localApproved =
            localData?.customImageApproved || localData?.isApproved;

          return {
            id: localId,
            title: res.label || "Untitled",
            name_lowercase: (res.label || "").toLowerCase(),
            description: res.description,
            isWikidataItem: true,
            coverImage:
              localCover ||
              "https://www.wikidata.org/static/images/project-logos/wikidatawiki.png",
            customImageApproved:
              localApproved !== undefined ? localApproved : true,
            isApproved: true,
          } as Game;
        });
        setWikidataResults(mapped);
        setWikidataLoading(false);
      })
      .catch((err) => {
        console.error("Wikidata search failed:", err);
        setWikidataLoading(false);
      });
  }, [debouncedSearch]);

  const filteredGames = useMemo(() => {
    // Deduplicate Firestore and Wikidata results by ID first, then by Title
    const seenIds = new Set(games.map((g) => g.id));
    const seenTitles = new Set(games.map((g) => (g.title || "").toLowerCase()));

    // Add Firestore results to sets already
    // Filter Wikidata results against seen IDs and Titles
    const uniqueWikidata = wikidataResults.filter((wg) => {
      const isNewId = !seenIds.has(wg.id);
      const isNewTitle = !seenTitles.has((wg.title || "").toLowerCase());

      // If we keep it, update seen sets to prevent internal Wikidata duplicates
      if (isNewId && isNewTitle) {
        seenIds.add(wg.id);
        seenTitles.add((wg.title || "").toLowerCase());
        return true;
      }
      return false;
    });

    const allGames = [...games, ...uniqueWikidata];

    return allGames.filter((game) => {
      // Basic search is now handled server-side for Firestore, but we keep client-side for additional filters
      // and for Wikidata results.

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
        if (activePlayTime === "quick") matchesTime = time < 30;
        if (activePlayTime === "standard")
          matchesTime = time >= 30 && time <= 90;
        if (activePlayTime === "epic") matchesTime = time > 90;
      }

      // Genre/Category Filter (Multi-select: Match ANY of selected)
      let matchesGenre = true;
      if (selectedGenres.length > 0) {
        matchesGenre = selectedGenres.some(
          (genre) =>
            game.categories?.includes(genre) || game.genres?.includes(genre),
        );
      }

      return matchesPlayers && matchesTime && matchesGenre;
    });
  }, [
    games,
    wikidataResults,
    activePlayerCount,
    activePlayTime,
    selectedGenres,
  ]);

  const hasActiveFilters =
    activePlayerCount !== null ||
    activePlayTime !== null ||
    selectedGenres.length > 0;

  const clearFilters = () => {
    setActivePlayerCount(null);
    setActivePlayTime(null);
    setSelectedGenres([]);
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) => (prev.includes(genre) ? [] : [genre]));
  };

  const handleGameClick = (game: Game) => {
    navigate(`/game/${game.id}`);
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
              <h1 className="text-4xl font-black text-white tracking-tight">
                Find a Game
              </h1>
              <p className="text-white/40 font-bold uppercase tracking-widest text-xs">
                Find games, designers, or publishers
              </p>
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
          availableGenres={BOARD_GAME_CATEGORIES}
          totalResults={
            searchTerm || hasActiveFilters ? filteredGames.length : totalCount
          }
          resultsLabel={
            searchTerm || hasActiveFilters ? "Matches Found" : "Total Games"
          }
          showAddManualLink={true}
          onAddManualClick={() => setIsAddModalOpen(true)}
          isLoading={loading || wikidataLoading}
        />

        {quotaExceeded && (
          <div className="mt-8 p-6 bg-rose-500/10 border border-rose-500/20 rounded-[2rem] text-rose-500 flex flex-col items-center gap-4 text-center">
            <Globe className="w-10 h-10 animate-bounce" />
            <div>
              <h3 className="font-black text-lg uppercase tracking-tight">
                Database Quota Exceeded
              </h3>
              <p className="text-sm font-bold opacity-70">
                We've reached our database limit for the day. Please check back
                tomorrow or try a different search.
              </p>
            </div>
          </div>
        )}

        {/* Results Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="animate-pulse bg-white/5 rounded-[2rem] h-48 border border-white/10 shadow-lg"
              />
            ))}
          </div>
        ) : (
          <>
            {filteredGames.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                  {filteredGames.map((hit) => {
                    const game = {
                      id: hit.id,
                      ...hit,
                      coverImage: hit.coverImage || hit.thumbnail || "",
                      customImageApproved:
                        hit.customImageApproved ?? hit.isApproved ?? true,
                    } as Game;
                    return (
                      <div key={game.id} className="relative">
                        <GameCard
                          game={game}
                          personalRating={profile?.ratings?.[game.id]}
                          groupRating={groupRatings[game.id]?.rating}
                          friendsRating={friendsRatings[game.id]}
                          groupName={groupRatings[game.id]?.groupName}
                          onClick={() => handleGameClick(game)}
                        />
                        {game.isWikidataItem && (
                          <div className="absolute top-4 right-4 bg-blue-500/80 backdrop-blur-md text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-lg z-20 flex items-center gap-1 border border-white/20">
                            <Globe className="w-2.5 h-2.5" /> Wikidata
                          </div>
                        )}
                        <AnimatePresence>
                          {jitLoadingId === game.id && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 bg-charcoal/80 backdrop-blur-sm rounded-[2rem] z-[30] flex flex-col items-center justify-center gap-4 border-2 border-emerald-accent/50"
                            >
                              <Loader2 className="w-10 h-10 text-emerald-accent animate-spin" />
                              <span className="font-black text-xs uppercase tracking-widest text-emerald-accent">
                                Fetching Details...
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
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
                      {loadingMore ? "Loading More..." : "Show More Games"}
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
                <h3 className="text-3xl font-black text-white mb-2 tracking-tight">
                  Game Not Found!
                </h3>
                <p className="text-white/40 font-bold mb-8">
                  We couldn't find "{searchTerm}" in our library.
                </p>

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
