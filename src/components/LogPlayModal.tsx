import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Search,
  Calendar,
  MapPin,
  Users,
  Crown,
  Plus,
  MessageSquare,
  Trophy,
  Check,
  ChevronRight,
  ChevronLeft,
  Dices,
  Shield,
  Swords,
  Smile,
  Frown,
  UserPlus,
  Loader2,
  ExternalLink,
  Layers,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db, OperationType, handleFirestoreError } from "../lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  startAt,
  endAt,
  limit,
} from "firebase/firestore";
import { cn } from "../lib/utils";
import D20Die from "./D20Die";
import GameTitleWithDC from "./GameTitleWithDC";
import { submitPlayLog } from "../services/playLogService";
import { useUser } from "../contexts/UserContext";
import UserAvatar from "./UserAvatar";
import { logSocialActivity } from "../lib/socialActivityLogger";
import { searchBGG, fetchAndCacheBGGGame } from '../services/bggService';

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
}

interface Group {
  id: string;
  name: string;
}

interface Player {
  name: string;
  score: number | string;
  isWinner: boolean;
  userId?: string;
  avatar?: string;
  avatarPreference?: "google" | "dicebear";
  avatarSeed?: string;
}

interface Team {
  players: Player[];
  score: number | string;
  isWinner: boolean;
}

interface LogPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGameId?: string;
  initialGame?: {
    id: string;
    title: string;
    coverImage?: string;
    isArtApproved?: boolean;
  };
  initialGroupId?: string;
}

const VIBE_OPTIONS = [
  "🤯 Brain Burner",
  "🗣️ Table Riot",
  "☕ Cozy & Chill",
  "🗡️ Cutthroat",
  "🗺️ Immersive Journey",
];

type GameMode = "ffa" | "teams" | "coop";

export default function LogPlayModal({
  isOpen,
  onClose,
  initialGameId,
  initialGame,
  initialGroupId,
}: LogPlayModalProps) {
  const { user, profile, userGroupIds } = useUser();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [jitLoadingGameId, setJitLoadingGameId] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [location, setLocation] = useState("");

  // Game Mode State
  const [gameMode, setGameMode] = useState<GameMode>("ffa");
  const [keepScore, setKeepScore] = useState(true);

  // FFA Players
  const [players, setPlayers] = useState<Player[]>([
    {
      name: user?.displayName || "Me",
      score: "",
      isWinner: false,
      userId: user?.uid,
      avatar:
        user?.photoURL ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`,
    },
  ]);

  // Teams State - Structure Refactored for Container Assignment
  const [teams, setTeams] = useState<Team[]>([
    {
      players: [
        {
          name: user?.displayName || "Me",
          score: "",
          isWinner: false,
          userId: user?.uid,
          avatar:
            user?.photoURL ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`,
        },
      ],
      score: "",
      isWinner: false,
    },
    {
      players: [],
      score: "",
      isWinner: false,
    },
  ]);
  const [selectedTeamIndex, setSelectedTeamIndex] = useState(0);

  const [isVictory, setIsVictory] = useState(true);
  const [rating, setRating] = useState(18);
  const [vibeCheck, setVibeCheck] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedExpansions, setSelectedExpansions] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [friends, setFriends] = useState<UserProfile[]>([]);

  // Player Selection States
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false);
  const [guestNameInput, setGuestNameInput] = useState("");

  useEffect(() => {
    if (user && profile) {
      fetchFriends();
      fetchGroups(user.uid);
    }
  }, [user?.uid, (profile as any)?.following?.length]);

  const fetchFriends = async () => {
    try {
      const followingIds = (profile as any)?.following || [];
      if (followingIds.length === 0) {
        setFriends([]);
        return;
      }

      const q = query(
        collection(db, "users"),
        where("uid", "in", followingIds.slice(0, 30)),
      );
      const snapshot = await getDocs(q);
      const friendProfiles = snapshot.docs.map(
        (doc) => ({ uid: doc.id, ...doc.data() }) as UserProfile,
      );

      setFriends(friendProfiles);
    } catch (error) {
      console.error("Error fetching friends for logger:", error);
    }
  };

  const fetchGroups = async (userId: string) => {
    try {
      const q = query(
        collection(db, "groups"),
        where("memberIds", "array-contains", userId),
      );
      const snapshot = await getDocs(q);
      const groupList = snapshot.docs.map(
        (doc) => ({ id: doc.id, name: doc.data().name }) as Group,
      );
      setGroups(groupList);
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  useEffect(() => {
    if (initialGroupId) {
      setSelectedGroupId(initialGroupId);
    } else if (isOpen) {
      // Only reset if it's a fresh open without an initial group
      setSelectedGroupId("");
    }
  }, [initialGroupId, isOpen]);

  useEffect(() => {
    if (initialGame) {
      setSelectedGame({
        id: initialGame.id,
        title: initialGame.title,
        coverImage:
          initialGame.coverImage || "https://picsum.photos/seed/game/400/400",
        isArtApproved: initialGame.isArtApproved ?? false,
        playTime: "60 min",
        expansions: (initialGame as any).expansions || [],
      });
      setSelectedExpansions([]);
      setStep(2);
    } else if (initialGameId) {
      const fetchInitialGame = async () => {
        try {
          const gameDoc = await getDoc(doc(db, "games", initialGameId));
          if (gameDoc.exists()) {
            setSelectedGame({ id: gameDoc.id, ...gameDoc.data() });
            setSelectedExpansions([]);
            setStep(2);
          }
        } catch (error) {
          console.error("Error fetching initial game:", error);
        }
      };
      fetchInitialGame();
    }
  }, [initialGameId, initialGame, isOpen]);

  // Instant Search Logic
  useEffect(() => {
    const searchGames = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        // Firestore prefix search: title >= query AND title <= query + \uf8ff
        const q = query(
          collection(db, "games"),
          orderBy("name_lowercase"),
          startAt(searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
          endAt(searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") + "\uf8ff"),
          limit(5),
        );

        const snapshot = await getDocs(q);
        const results = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            coverImage: data.coverImage || data.thumbnail || "",
            customImageApproved:
              data.customImageApproved || data.isApproved || false,
          } as any;
        });
        
        let allResults = [...results];
        
        // BGG Fallback if local results are sparse (less than 3)
        if (results.length < 3) {
          const bggResults = await searchBGG(searchQuery);
          // filter out duplicates by checking if local results already have this title
          const seenTitles = new Set(results.map(r => (r.title || '').toLowerCase()));
          const uniqueBGG = bggResults.filter(bgg => {
            const titleLower = (bgg.title || '').toLowerCase();
            if (seenTitles.has(titleLower)) return false;
            seenTitles.add(titleLower);
            return true;
          });
          allResults = [...allResults, ...uniqueBGG];
        }
        
        setSearchResults(allResults);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchGames, 500);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleAddPlayerToTeam = (friend: UserProfile, teamIdx: number) => {
    const newPlayer = {
      name: friend.displayName,
      score: "",
      isWinner: false,
      userId: friend.uid,
      avatar:
        friend.photoURL ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.uid}`,
    };

    if (teams.some((team) => team.players.some((p) => p.userId === friend.uid)))
      return;

    const newTeams = [...teams];
    newTeams[teamIdx].players = [...newTeams[teamIdx].players, newPlayer];
    setTeams(newTeams);
    setIsAddFriendOpen(false);
  };

  const handleAddGuestToTeam = (name: string, teamIdx: number) => {
    if (!name.trim()) return;

    const newPlayer = {
      name: name.trim(),
      score: "",
      isWinner: false,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name.trim()}`,
    };

    const newTeams = [...teams];
    newTeams[teamIdx].players = [...newTeams[teamIdx].players, newPlayer];
    setTeams(newTeams);

    setGuestNameInput("");
    setIsAddGuestOpen(false);
  };

  const addPlayerFromFriend = (friend: UserProfile) => {
    if (gameMode === "teams") {
      handleAddPlayerToTeam(friend, selectedTeamIndex);
      return;
    }

    const newPlayer = {
      name: friend.displayName,
      score: "",
      isWinner: false,
      userId: friend.uid,
      avatar:
        friend.photoURL ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.uid}`,
    };

    if (players.some((p) => p.userId === friend.uid)) return;
    setPlayers([...players, newPlayer]);
    setIsAddFriendOpen(false);
  };

  const handleAddGuest = () => {
    if (gameMode === "teams") {
      handleAddGuestToTeam(guestNameInput, selectedTeamIndex);
      return;
    }

    if (!guestNameInput.trim()) return;

    const newPlayer = {
      name: guestNameInput.trim(),
      score: "",
      isWinner: false,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${guestNameInput.trim()}`,
    };

    setPlayers([...players, newPlayer]);
    setGuestNameInput("");
    setIsAddGuestOpen(false);
  };

  const removePlayer = (playerToRemove: Player) => {
    if (playerToRemove.userId === user?.uid) return;

    if (gameMode === "ffa" || gameMode === "coop") {
      setPlayers(
        players.filter((p) =>
          p.userId
            ? p.userId !== playerToRemove.userId
            : p.name !== playerToRemove.name,
        ),
      );
    } else {
      setTeams(
        teams.map((team) => ({
          ...team,
          players: team.players.filter((p) =>
            p.userId
              ? p.userId !== playerToRemove.userId
              : p.name !== playerToRemove.name,
          ),
        })),
      );
    }
  };

  const toggleWinner = (index: number) => {
    const newPlayers = players.map((p, i) => ({
      ...p,
      isWinner: i === index ? !p.isWinner : p.isWinner,
    }));
    setPlayers(newPlayers);
  };

  const toggleTeamWinner = (teamIndex: number) => {
    const newTeams = [...teams];
    newTeams[teamIndex].isWinner = !newTeams[teamIndex].isWinner;
    setTeams(newTeams);
  };

  const updateTeamScore = (teamIndex: number, score: number | string) => {
    const newTeams = [...teams];
    newTeams[teamIndex].score = score;
    setTeams(newTeams);
  };

  const addTeam = () => {
    setTeams([...teams, { players: [], score: "", isWinner: false }]);
  };

  const handleSubmit = async () => {
    if (!selectedGame || !user) return;

    setIsSubmitting(true);
    try {
      const finalPlayers =
        gameMode === "teams"
          ? teams.flatMap((t, tIdx) =>
              t.players.map((p) => ({
                ...p,
                score: keepScore ? (t.score === "" ? 0 : Number(t.score)) : null, // Apply team score to all players in team if keepScore is true
                isWinner: t.isWinner,
              })),
            )
          : players.map((p) => ({
              ...p,
              score: keepScore ? (p.score === "" ? 0 : Number(p.score)) : null,
            }));

      const result = await submitPlayLog({
        gameId: selectedGame.id,
        gameTitle: selectedGame.title,
        gameCover: selectedGame.coverImage,
        isArtApproved: selectedGame.isArtApproved,
        groupId: selectedGroupId || undefined,
        rating,
        vibeTag: vibeCheck || "🎲 Standard Game",
        userId: user.uid,
        userName: profile?.displayName || profile?.username || user.displayName || "Anonymous",
        userAvatar:
          profile?.photoURL || user.photoURL ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        players: finalPlayers,
        location,
        date,
        includedExpansions: selectedGame.expansions
          ? selectedGame.expansions
              .filter((exp: any) => selectedExpansions.includes(exp.id))
              .map((exp: any) => ({ id: exp.id, title: exp.title }))
          : [],
      });

      if (result.success) {
        try {
          // Log Activity
          await logSocialActivity({
            actorId: user.uid,
            actorName: profile?.displayName || profile?.username || user.displayName || "Anonymous",
            type: "LOG_PLAY",
            targetId: selectedGame.id,
            targetName: selectedGame.title,
            metadata: {
              playId: result.playId,
              gameCover: selectedGame.coverImage,
              isArtApproved: selectedGame.isArtApproved,
              score: rating,
              winners: finalPlayers.filter((p) => p.isWinner).map((p) => p.name),
              ...(selectedGroupId && {
                groupId: selectedGroupId,
                groupName: groups.find((g) => g.id === selectedGroupId)?.name,
              }),
            },
          });
        } catch (error) {
          console.error("DEBUG: Nav Menu Log Play Failed: ", error);
        }

        onClose();
        setStep(1);
        setSelectedGame(null);
        setSelectedExpansions([]);
        setPlayers([
          {
            name: user?.displayName || "Me",
            score: "",
            isWinner: false,
            userId: user?.uid,
            avatar:
              profile?.photoURL ||
              user?.photoURL ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`,
            avatarPreference: profile?.avatarPreference || "google",
            avatarSeed: profile?.avatarSeed || user?.uid,
          },
        ]);
        setTeams([
          {
            players: [
              {
                name: user?.displayName || "Me",
                score: "",
                isWinner: false,
                userId: user?.uid,
                avatar:
                  profile?.photoURL ||
                  user?.photoURL ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`,
                avatarPreference: profile?.avatarPreference || "google",
                avatarSeed: profile?.avatarSeed || user?.uid,
              },
            ],
            score: "",
            isWinner: false,
          },
          { players: [], score: "", isWinner: false },
        ]);
      }
    } catch (error) {
      console.error("Submission failed:", error);
      alert("There was an error saving your play. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-2xl max-h-[90vh] bg-charcoal rounded-[3rem] shadow-2xl overflow-hidden border border-white/10 flex flex-col"
      >
        {/* Header - Sticky Style */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-900 p-8 text-white relative shrink-0 z-10">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 bg-black/20 rounded-xl hover:bg-black/40 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-inner">
              <Trophy className="w-6 h-6 text-gold-accent" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">
                Log a Session
              </h2>
              <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest opacity-80">
                CritShelf Premium Logger
              </p>
            </div>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="p-8 flex-1 overflow-y-auto no-scrollbar space-y-12">
          {/* Section 1: The Details & Game Mode */}
          <section className="space-y-8">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-emerald-accent rounded-full" />
              <h3 className="text-xs font-black text-white/40 uppercase tracking-widest">
                The Details
              </h3>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {isSearching ? (
                    <Loader2 className="w-5 h-5 text-emerald-accent animate-spin" />
                  ) : (
                    <Search className="w-5 h-5 text-white/20" />
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Select Game..."
                  className="w-full bg-white/5 border-2 border-white/10 rounded-2xl py-4 pl-12 pr-4 font-bold text-white outline-none focus:border-emerald-accent transition-all"
                  value={selectedGame?.title || searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (selectedGame) setSelectedGame(null);
                  }}
                />
                {searchQuery && !selectedGame && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl z-50 overflow-hidden">
                    {searchResults.length > 0
                      ? searchResults.map((game) => (
                          <button
                            key={game.id}
                            onClick={async () => {
                              if (game.id.startsWith('bgg_') || game.isBGGItem) {
                                setJitLoadingGameId(game.id);
                                try {
                                  const savedGame = await fetchAndCacheBGGGame(game.id);
                                  setSelectedGame(savedGame);
                                } catch (e) {
                                  console.error(e);
                                  setSelectedGame(game);
                                } finally {
                                  setJitLoadingGameId(null);
                                }
                              } else {
                                setSelectedGame(game);
                              }
                              setSelectedExpansions([]);
                              setSearchQuery("");
                              setSearchResults([]);
                            }}
                            disabled={jitLoadingGameId === game.id}
                            className={cn("w-full flex items-center gap-4 p-4 hover:bg-emerald-accent/10 transition-all text-left border-b border-white/5 last:border-0 group", jitLoadingGameId === game.id && "opacity-50 cursor-wait")}
                          >
                            {jitLoadingGameId === game.id ? (
                              <div className="w-10 h-10 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 text-emerald-accent animate-spin" />
                              </div>
                            ) : (
                              <img
                                src={game.coverImage || game.coverArt || null}
                                className="w-10 h-10 rounded-lg object-cover border border-white/10"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <GameTitleWithDC
                                game={game}
                                shieldSize="sm"
                                titleClassName="text-white block group-hover:text-emerald-accent"
                              />
                              <span className="text-[8px] font-black text-white/20 uppercase tracking-widest pl-10">
                                {game.publisher || "Board Game"}
                              </span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-emerald-accent transition-all" />
                          </button>
                        ))
                      : !isSearching &&
                        searchQuery.length >= 2 && (
                          <div className="p-6 text-center">
                            <p className="text-white/40 font-bold text-sm mb-3">
                              Game not found?
                            </p>
                            <button
                              onClick={() => navigate("/browse")}
                              className="flex items-center gap-2 text-emerald-accent font-black text-xs uppercase tracking-widest mx-auto hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Add it manually
                            </button>
                          </div>
                        )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                  <input
                    type="date"
                    className="w-full bg-white/5 border-2 border-white/10 rounded-2xl py-4 pl-12 pr-4 font-bold text-white outline-none focus:border-emerald-accent transition-all"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                  <input
                    type="text"
                    placeholder="Location (Optional)"
                    className="w-full bg-white/5 border-2 border-white/10 rounded-2xl py-4 pl-12 pr-4 font-bold text-white outline-none focus:border-emerald-accent transition-all"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>

              {/* Expansions Selection */}
              {selectedGame?.expansions &&
                selectedGame.expansions.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-accent" />
                      <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                        Expansions Included (Optional)
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedGame.expansions.map((exp: any) => (
                        <button
                          key={exp.id}
                          type="button"
                          onClick={() => {
                            setSelectedExpansions((prev) =>
                              prev.includes(exp.id)
                                ? prev.filter((id) => id !== exp.id)
                                : [...prev, exp.id],
                            );
                          }}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                            selectedExpansions.includes(exp.id)
                              ? "bg-emerald-accent text-charcoal border-emerald-accent"
                              : "bg-white/5 text-white/40 border-white/10 hover:border-white/20",
                          )}
                        >
                          {exp.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {/* Game Mode Segmented Control */}
              <div className="bg-white/5 p-1 rounded-2xl flex gap-1 border border-white/10">
                {(["ffa", "teams", "coop"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setGameMode(mode)}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      gameMode === mode
                        ? "bg-emerald-accent text-charcoal shadow-lg"
                        : "text-white/40 hover:text-white/60",
                    )}
                  >
                    {mode === "ffa"
                      ? "Free-for-All"
                      : mode === "teams"
                        ? "Teams"
                        : "Co-op"}
                  </button>
                ))}
              </div>

              {/* Keep Score Toggle */}
              <div
                onClick={() => setKeepScore(!keepScore)}
                className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10 cursor-pointer hover:bg-white/10 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                      keepScore
                        ? "bg-emerald-accent/20 text-emerald-accent"
                        : "bg-white/5 text-white/20",
                    )}
                  >
                    <Dices className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-widest">
                      Keep Points/Score
                    </h4>
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                      Track numeric values during play
                    </p>
                  </div>
                </div>
                <div
                  className={cn(
                    "w-12 h-6 rounded-full relative transition-all duration-300",
                    keepScore ? "bg-emerald-accent" : "bg-white/10",
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-lg",
                      keepScore ? "left-7" : "left-1",
                    )}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Player & Team Selection */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-emerald-accent rounded-full" />
              <h3 className="text-xs font-black text-white/40 uppercase tracking-widest">
                {gameMode === "teams" ? "Team Rosters" : "Player Selection"}
              </h3>
            </div>

            {gameMode !== "teams" && (
              <>
                {/* Selected Players Tags (FFA/Co-op Only) */}
                <div className="flex flex-wrap gap-3">
                  {players.map((player, pIdx) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key={`${player.userId || player.name}-${pIdx}`}
                      className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-full group transition-all hover:border-emerald-accent/30"
                    >
                      <UserAvatar
                        user={{
                          photoURL: player.avatar,
                          avatarPreference: player.avatarPreference,
                          avatarSeed: player.avatarSeed,
                          uid: player.userId,
                          displayName: player.name,
                        }}
                        size="xs"
                        className="w-6 h-6 rounded-full border border-white/10"
                      />
                      <span className="text-xs font-bold text-white/80">
                        {player.name}
                      </span>
                      {player.userId !== user?.uid && (
                        <button
                          onClick={() => removePlayer(player)}
                          className="p-1 text-white/20 hover:text-rose-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Add Buttons (FFA/Co-op Only) */}
                <div className="flex gap-4">
                  <button
                    onClick={() => setIsAddFriendOpen(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-emerald-accent text-emerald-accent font-black text-xs uppercase tracking-widest hover:bg-emerald-accent/5 transition-all active:scale-95"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add Friend
                  </button>
                  <button
                    onClick={() => setIsAddGuestOpen(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-white/10 text-white/40 font-black text-xs uppercase tracking-widest hover:bg-white/5 transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    Add Guest
                  </button>
                </div>
              </>
            )}

            <div className="space-y-8">
              {/* Teams Mode - Container-First Assignment */}
              {gameMode === "teams" ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {teams.map((team, tIdx) => (
                      <div
                        key={tIdx}
                        className={cn(
                          "bg-white/5 rounded-[2.5rem] p-6 border-2 transition-all relative flex flex-col gap-6",
                          team.isWinner
                            ? "border-gold-accent bg-gold-accent/5 shadow-[0_10px_40px_rgba(251,191,36,0.1)]"
                            : "border-white/10",
                        )}
                      >
                        {/* Team Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs border",
                                team.isWinner
                                  ? "bg-gold-accent text-charcoal border-transparent"
                                  : "bg-white/10 text-white/40 border-white/10",
                              )}
                            >
                              {tIdx + 1}
                            </div>
                            <h4 className="text-xs font-black text-white uppercase tracking-widest">
                              Team {tIdx + 1}
                            </h4>
                          </div>

                          <button
                            onClick={() => toggleTeamWinner(tIdx)}
                            className={cn(
                              "p-3 rounded-2xl transition-all shadow-lg",
                              team.isWinner
                                ? "bg-gold-accent text-charcoal scale-110"
                                : "bg-white/5 text-white/20 hover:text-gold-accent hover:bg-gold-accent/10",
                            )}
                          >
                            <Crown className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Player List Inside Team */}
                        <div className="space-y-3 min-h-[100px] border-y border-white/5 py-4">
                          {team.players.map((p, pIdx) => (
                            <div
                              key={pIdx}
                              className="flex items-center justify-between group/p"
                            >
                              <div className="flex items-center gap-3">
                                <UserAvatar
                                  user={{
                                    photoURL: p.avatar,
                                    avatarPreference: p.avatarPreference,
                                    avatarSeed: p.avatarSeed,
                                    uid: p.userId,
                                    displayName: p.name,
                                  }}
                                  size="xs"
                                  className="w-8 h-8 rounded-full border border-white/10"
                                />
                                <span
                                  className={cn(
                                    "text-sm font-bold",
                                    p.userId === user?.uid
                                      ? "text-gold-accent"
                                      : "text-white/60",
                                  )}
                                >
                                  {p.name}
                                </span>
                              </div>
                              {p.userId !== user?.uid && (
                                <button
                                  onClick={() => removePlayer(p)}
                                  className="opacity-0 group-hover/p:opacity-100 p-1.5 text-white/20 hover:text-rose-500 transition-all hover:bg-rose-500/10 rounded-lg"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}

                          {team.players.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center opacity-20 py-4">
                              <Users className="w-8 h-8 mb-2" />
                              <p className="text-[10px] font-black uppercase tracking-widest">
                                No Players
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Team Actions: Add & Score */}
                        <div className="space-y-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedTeamIndex(tIdx);
                                setIsAddFriendOpen(true);
                              }}
                              className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              Friend
                            </button>
                            <button
                              onClick={() => {
                                setSelectedTeamIndex(tIdx);
                                setIsAddGuestOpen(true);
                              }}
                              className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Guest
                            </button>
                          </div>

                          {keepScore && (
                            <div className="flex items-center gap-4 bg-black/20 p-3 rounded-2xl border border-white/5">
                              <span className="text-[10px] font-black text-white/20 uppercase tracking-widest pl-2">
                                Score
                              </span>
                              <input
                                type="number"
                                className="w-full bg-transparent border-none text-right font-black text-white focus:ring-0 text-xl"
                                placeholder="0"
                                value={team.score}
                                onChange={(e) =>
                                  updateTeamScore(
                                    tIdx,
                                    e.target.value === "" ? "" : Number(e.target.value),
                                  )
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={addTeam}
                    className="w-full py-6 rounded-[2rem] border-2 border-dashed border-white/10 hover:border-emerald-accent/30 text-white/20 hover:text-emerald-accent transition-all flex flex-col items-center gap-2 group"
                  >
                    <Plus className="w-6 h-6 group-hover:scale-125 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Add Another Team
                    </span>
                  </button>
                </div>
              ) : (
                /* FFA / Co-op Player List */
                <div className="grid grid-cols-1 gap-2">
                  {players.map((player, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10 group/player"
                    >
                      <div className="flex items-center gap-4">
                        <UserAvatar
                          user={{
                            photoURL: player.avatar,
                            avatarPreference: player.avatarPreference,
                            avatarSeed: player.avatarSeed,
                            uid: player.userId,
                            displayName: player.name,
                          }}
                          size="xs"
                          className="w-10 h-10 rounded-full border-2 border-white/10"
                        />
                        <span className="font-black text-white">
                          {player.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        {keepScore && (
                          <input
                            type="number"
                            placeholder="Score"
                            className="w-20 bg-black/40 border border-white/10 rounded-xl p-2 text-center font-black text-white outline-none focus:border-emerald-accent"
                            value={player.score}
                            onChange={(e) => {
                              const newPlayers = [...players];
                              newPlayers[idx].score =
                                e.target.value === "" ? "" : Number(e.target.value);
                              setPlayers(newPlayers);
                            }}
                          />
                        )}
                        {gameMode === "ffa" && (
                          <button
                            onClick={() => toggleWinner(idx)}
                            className={cn(
                              "p-2.5 rounded-xl transition-all",
                              player.isWinner
                                ? "bg-gold-accent text-charcoal shadow-lg scale-110"
                                : "text-white/20 hover:text-white/40",
                            )}
                          >
                            <Crown className="w-6 h-6" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Section 3: The Outcome (Co-op specific) */}
          {gameMode === "coop" && (
            <section className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 bg-emerald-accent rounded-full" />
                <h3 className="text-xs font-black text-white/40 uppercase tracking-widest">
                  The Outcome
                </h3>
              </div>
              <div className="bg-white/5 rounded-3xl p-8 border-2 border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div
                    className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl transition-all",
                      isVictory
                        ? "bg-emerald-accent text-charcoal"
                        : "bg-rose-500 text-white",
                    )}
                  >
                    {isVictory ? (
                      <Smile className="w-8 h-8" />
                    ) : (
                      <Frown className="w-8 h-8" />
                    )}
                  </div>
                  <div>
                    <p className="font-black text-white text-2xl tracking-tight">
                      {isVictory ? "Victory" : "Defeat"}
                    </p>
                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
                      Table Consensus
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsVictory(!isVictory)}
                  className={cn(
                    "px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95",
                    isVictory
                      ? "bg-white/10 text-white hover:bg-white/20"
                      : "bg-emerald-accent text-charcoal",
                  )}
                >
                  Toggle Result
                </button>
              </div>
            </section>
          )}

          {/* Section 4: Session Vibe & Group Tagging */}
          <section className="space-y-8">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-emerald-accent rounded-full" />
              <h3 className="text-xs font-black text-white/40 uppercase tracking-widest">
                Vibe & Group
              </h3>
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                  <select
                    className="w-full bg-white/5 border-2 border-white/10 rounded-2xl py-4 pl-12 pr-4 font-bold text-white outline-none focus:border-emerald-accent appearance-none transition-all"
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                  >
                    <option value="" className="bg-charcoal">
                      Link to Group (Optional)...
                    </option>
                    {groups.map((group) => (
                      <option
                        key={group.id}
                        value={group.id}
                        className="bg-charcoal"
                      >
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <Smile className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                  <select
                    className="w-full bg-white/5 border-2 border-white/10 rounded-2xl py-4 pl-12 pr-4 font-bold text-white outline-none focus:border-emerald-accent appearance-none transition-all"
                    value={vibeCheck}
                    onChange={(e) => setVibeCheck(e.target.value)}
                  >
                    <option value="" className="bg-charcoal">
                      Session Vibe (Optional)...
                    </option>
                    {VIBE_OPTIONS.map((vibe) => (
                      <option key={vibe} value={vibe} className="bg-charcoal">
                        {vibe}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-white/5 rounded-[2.5rem] p-6 sm:p-8 border border-white/10">
                <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
                  <div className="shrink-0">
                    <D20Die value={rating} size="lg" />
                  </div>
                  <div className="flex-1 w-full space-y-6">
                    <div className="space-y-2">
                      <div className="text-center">
                        <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] block">
                          Rate this Session (Optional)
                        </span>
                        <span className="text-xs text-white/40 italic block mt-1">Ratings are out of 20</span>
                      </div>
                      <div className="flex justify-between text-[9px] font-black text-white/20 uppercase tracking-widest px-1">
                        <span>Critical Fail</span>
                        <span>Nat 20</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-accent"
                        value={rating}
                        onChange={(e) => setRating(parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer - Sticky Style */}
        <div className="p-8 bg-black/40 border-t border-white/10 flex items-center justify-end shrink-0">
          <button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              !selectedGame ||
              !date ||
              (gameMode === "teams"
                ? teams.every((t) => t.players.length === 0)
                : players.length === 0) ||
              (gameMode !== "coop" &&
                (gameMode === "teams"
                  ? !teams.some((t) => t.isWinner)
                  : !players.some((p) => p.isWinner)))
            }
            className="w-full sm:w-auto bg-gold-accent text-charcoal px-12 py-5 rounded-[1.5rem] font-black shadow-xl hover:shadow-gold-accent/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
          >
            {isSubmitting ? "Recording Session..." : "Log Session"}
            <Check className="w-6 h-6" />
          </button>
        </div>
      </motion.div>

      {/* Add Friend Modal */}
      <AnimatePresence>
        {isAddFriendOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddFriendOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-charcoal rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-lg font-black text-white tracking-tight">
                  Add Friend
                </h3>
                <button
                  onClick={() => setIsAddFriendOpen(false)}
                  className="text-white/20 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 max-h-[400px] overflow-y-auto no-scrollbar">
                {friends.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-white/40 italic font-medium">
                      No friends added yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {friends.map((friend) => {
                      const isAdded =
                        gameMode === "teams"
                          ? teams.some((t) =>
                              t.players.some((p) => p.userId === friend.uid),
                            )
                          : players.some((p) => p.userId === friend.uid);

                      return (
                        <button
                          key={friend.uid}
                          disabled={isAdded}
                          onClick={() => addPlayerFromFriend(friend)}
                          className={cn(
                            "w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left group",
                            isAdded
                              ? "opacity-30 cursor-not-allowed"
                              : "hover:bg-white/5 bg-white/[0.02]",
                          )}
                        >
                          <UserAvatar
                            user={{
                              photoURL: friend.photoURL,
                              avatarPreference: (friend as any)
                                .avatarPreference,
                              avatarSeed: (friend as any).avatarSeed,
                              uid: friend.uid,
                              displayName: friend.displayName,
                            }}
                            size="md"
                            className="w-12 h-12 rounded-xl border border-white/10"
                          />
                          <div className="flex-1">
                            <p className="font-black text-white">
                              {friend.displayName}
                            </p>
                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                              CritShelf User
                            </p>
                          </div>
                          {!isAdded && (
                            <Plus className="w-5 h-5 text-emerald-accent opacity-0 group-hover:opacity-100 transition-all" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Guest Modal */}
      <AnimatePresence>
        {isAddGuestOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddGuestOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-charcoal rounded-[2rem] shadow-2xl overflow-hidden border border-white/10 p-8"
            >
              <h3 className="text-xl font-black text-white tracking-tight mb-6">
                Add Guest
              </h3>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 block">
                    Guest Name
                  </label>
                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g. Uncle Bob"
                    className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-4 font-bold text-white outline-none focus:border-gold-accent transition-all"
                    value={guestNameInput}
                    onChange={(e) => setGuestNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddGuest()}
                  />
                </div>
                <button
                  onClick={handleAddGuest}
                  className="w-full bg-gold-accent text-charcoal py-4 rounded-2xl font-black shadow-lg hover:shadow-gold-accent/20 transition-all active:scale-95"
                >
                  Add to Roster
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
