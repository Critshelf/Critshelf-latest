import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  User as UserIcon,
  Settings,
  LogOut,
  Shield,
  Dices,
  Users,
  Trophy,
  Mail,
  Camera,
  ChevronRight,
  History,
  Crown,
  MapPin,
  Calendar,
  LayoutGrid,
  Star,
  Plus,
  Search,
  X,
  Loader2,
  Check,
  Edit2,
  ChevronDown,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { auth, db, OperationType, handleFirestoreError } from "../lib/firebase";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  getCountFromServer,
  documentId,
} from "firebase/firestore";
import { cn } from "../lib/utils";
import { Link, useNavigate } from "react-router-dom";
import D20Die from "../components/D20Die";
import ACBadge from "../components/ACBadge";
import UserAvatar from "../components/UserAvatar";
import ActivityItem from "../components/ActivityItem";

import { useUser } from "../contexts/UserContext";

interface GameSession {
  id: string;
  gameTitle: string;
  date: string;
  location: string;
  players: { name: string; score: number; isWinner: boolean }[];
  notes: string;
}

interface Favorite {
  gameId: string;
  gameTitle: string;
  gameCover: string;
  isArtApproved?: boolean;
  rating: number | "-";
  isPersonal?: boolean;
}

interface Game {
  id: string;
  title: string;
  coverImage: string;
  isArtApproved?: boolean;
}

const TITLE_OPTIONS = [
  "Master Strategist",
  "Rules Lawyer",
  "Dice Whisperer",
  "Meeple Monarch",
  "Card Shark",
  "Worker Placement Prodigy",
  "Campaign Legend",
  "Tabletop Tactician",
  "Analysis Paralysis Survivor",
  "Critical Roller",
];

export default function Profile() {
  const {
    user,
    profile,
    refreshProfile,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    signOut,
    isUsernameAvailable,
  } = useUser();
  const [activities, setActivities] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [localAvatarPreference, setLocalAvatarPreference] = useState<
    "google" | "dicebear"
  >("google");
  const [localAvatarSeed, setLocalAvatarSeed] = useState("");
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Game[]>([]);
  const [gamesCount, setGamesCount] = useState<number | "-">("-");
  const [groupsCount, setGroupsCount] = useState<number | "-">("-");
  const [winsCount, setWinsCount] = useState<number | "-">("-");
  const [searching, setSearching] = useState(false);
  const [updatingTitle, setUpdatingTitle] = useState(false);
  const navigate = useNavigate();

  // Debounce search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setDebouncedSearchQuery("");
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Execute database search
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearchQuery.trim()) return;

      setSearching(true);
      try {
        const queryTerm = debouncedSearchQuery.toLowerCase();
        const q = query(
          collection(db, "games"),
          where("name_lowercase", ">=", queryTerm),
          where("name_lowercase", "<=", queryTerm + "\uf8ff"),
          orderBy("name_lowercase"),
          limit(10),
        );
        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Game,
        );
        setSearchResults(results);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearchQuery]);

  // Auth States
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [acceptedBeta, setAcceptedBeta] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // Debounced Username Check
  useEffect(() => {
    if (!isSignUp || username.length < 3) {
      setUsernameStatus("idle");
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus("checking");
      const available = await isUsernameAvailable(username);
      setUsernameStatus(available ? "available" : "taken");
    }, 500);

    return () => clearTimeout(timer);
  }, [username, isSignUp, isUsernameAvailable]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      if (isSignUp) {
        if (usernameStatus !== "available") {
          throw new Error("Please choose a different username.");
        }
        if (!acceptedBeta) {
          throw new Error("You must acknowledge the beta testing terms.");
        }
        await signUpWithEmail(email, password, username);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (error: any) {
      setAuthError(error.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUpdateTitle = async (newTitle: string) => {
    if (!user) return;
    setUpdatingTitle(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        profileTitle: newTitle,
      });
      await refreshProfile();
      setShowTitleModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setUpdatingTitle(false);
    }
  };

  useEffect(() => {
    if (user && profile) {
      setLoadingContent(true);
      Promise.all([
        fetchRecentActivities(user.uid),
        fetchFavorites(user.uid),
        fetchStats(user.uid),
      ]).finally(() => setLoadingContent(false));
    } else {
      setActivities([]);
      setFavorites([]);
      setGamesCount("-");
      setGroupsCount("-");
      setWinsCount("-");
    }
  }, [user, profile]);

  const fetchStats = async (userId: string) => {
    try {
      // Games Count (Only those marked as 'owned')
      const gamesQ = query(
        collection(db, "userCollections"),
        where("userId", "==", userId),
        where("shelf", "==", "owned"),
      );
      const gamesSnap = await getCountFromServer(gamesQ);
      setGamesCount(gamesSnap.data().count);

      // Groups Count (Where user is a member)
      const groupsQ = query(
        collection(db, "groups"),
        where("memberIds", "array-contains", userId),
      );
      const groupsSnap = await getCountFromServer(groupsQ);
      setGroupsCount(groupsSnap.data().count);

      // Wins Count
      const winsQ = query(
        collection(db, "plays"),
        where("winnerIds", "array-contains", userId)
      );
      const winsSnap = await getCountFromServer(winsQ);
      setWinsCount(winsSnap.data().count);
      console.log("Wins count fetched successfully (may require composite index if modified to add other filters).");
    } catch (error) {
      console.error("Error fetching profile stats:", error);
    }
  };

  const fetchFavorites = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        let currentFavorites = data.favorites || [];

        if (currentFavorites.length > 0) {
          // Fetch personal ratings for these games to show "My Rating"
          const gameIds = currentFavorites
            .map((f: any) => f.gameId)
            .slice(0, 10);

          if (!gameIds || gameIds.length === 0) return;
          console.log("1. IDs sent to Firebase:", gameIds);

          try {
            // 1. Fetch game details for cover images
            const gamesQ = query(
              collection(db, "games"),
              where(documentId(), "in", gameIds),
            );
            const gamesSnap = await getDocs(gamesQ);
            console.log(
              "2. Raw Firebase Data:",
              gamesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
            );

            const gamesMap = new Map();
            gamesSnap.docs.forEach((d) => gamesMap.set(d.id, d.data()));

            // 2. Fetch personal ratings
            const reviewsQ = query(
              collection(db, "reviews"),
              where("userId", "==", userId),
              where("gameId", "in", gameIds),
            );
            const reviewsSnap = await getDocs(reviewsQ);
            const ratingsMap = reviewsSnap.docs.reduce(
              (acc, doc) => {
                const reviewData = doc.data();
                acc[reviewData.gameId] = reviewData.score;
                return acc;
              },
              {} as Record<string, number>,
            );

            // Enrich favorites with personal scores and actual cover images
            currentFavorites = currentFavorites.map((f: any) => {
              const gameData = gamesMap.get(f.gameId) || {};
              return {
                ...f,
                ...gameData,
                gameCover: gameData?.coverImage || f.gameCover || "",
                rating: ratingsMap[f.gameId] ?? "-",
                isPersonal: ratingsMap[f.gameId] !== undefined,
              };
            });
          } catch (reviewError) {
            console.warn("Failed to fetch extended favorite data", reviewError);
            currentFavorites = currentFavorites.map((f: any) => ({
              ...f,
              isPersonal: false,
            }));
          }

          setFavorites(currentFavorites);
        } else {
          setFavorites([]);
        }
      }
    } catch (error) {
      console.error("Error fetching favorites:", error);
    }
  };

  const addFavorite = async (game: Game) => {
    if (!user || favorites.length >= 3) return;

    // Check for existing personal rating to store in cached favorite object
    let personalScore: number | "-" = "-";
    let isPersonal = false;

    try {
      const q = query(
        collection(db, "reviews"),
        where("gameId", "==", game.id),
        where("userId", "==", user.uid),
        limit(1),
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        personalScore = snap.docs[0].data().score;
        isPersonal = true;
      }
    } catch (err) {
      console.warn("Using fallback for favorite rating during addition");
    }

    const newFavorite: Favorite = {
      gameId: game.id,
      gameTitle: game.title,
      gameCover: game.coverImage,
      isArtApproved: game.isArtApproved,
      rating: personalScore,
      isPersonal,
    };

    try {
      await updateDoc(doc(db, "users", user.uid), {
        favorites: arrayUnion(newFavorite),
      });
      setFavorites([...favorites, newFavorite]);
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
    } catch (error) {
      console.error("Failed to add favorite:", error);
    }
  };

  const fetchRecentActivities = async (userId: string) => {
    try {
      const q = query(
        collection(db, "activities"),
        where("userId", "==", userId),
        orderBy("timestamp", "desc"),
        limit(3),
      );
      const snapshot = await getDocs(q);
      const activityListRaw = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch fresh game data to enrich activities
      const gameIds = activityListRaw
        .map((a: any) => a.metadata?.gameId)
        .filter(Boolean);
      const uniqueGameIds = Array.from(new Set(gameIds)).slice(0, 10);

      const gamesMap = new Map();
      if (uniqueGameIds.length > 0) {
        const gamesQ = query(
          collection(db, "games"),
          where(documentId(), "in", uniqueGameIds),
        );
        const gamesSnap = await getDocs(gamesQ);
        gamesSnap.docs.forEach((doc) => gamesMap.set(doc.id, doc.data()));
      }

      const activityList = activityListRaw.map((a: any) => {
        if (a.metadata && a.metadata.gameId) {
          const gameData = gamesMap.get(a.metadata.gameId) || {};
          return {
            ...a,
            metadata: {
              ...a.metadata,
              ...gameData, // Apply fresh game data LAST to win property collisions
            },
          };
        }
        return a;
      });

      setActivities(activityList);
    } catch (error) {
      console.error("Error fetching activities:", error);
    }
  };

  const handleSaveAvatar = async () => {
    if (!user) return;

    setSavingAvatar(true);
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        avatarPreference: localAvatarPreference,
        avatarSeed: localAvatarSeed,
      });
      await refreshProfile();
      setShowAvatarModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "users");
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setSavingProfile(true);
    try {
      const userDocRef = doc(db, "users", user.uid);
      const updates = {
        displayName: editName,
        bio: editBio,
        location: editLocation,
      };
      await updateDoc(userDocRef, updates);
      await refreshProfile();
      setShowEditModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "users");
    } finally {
      setSavingProfile(false);
    }
  };

  if (loadingContent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-emerald-accent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 bg-charcoal">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/5 border border-white/10 p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center backdrop-blur-xl"
        >
          <div className="w-20 h-20 bg-emerald-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <UserIcon className="w-10 h-10 text-emerald-accent" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="text-white/40 mb-8 text-sm font-medium">
            Join the elite community of tabletop strategists on CritShelf.
          </p>

          <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
            {isSignUp && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-2 ml-1">
                  Unique Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
                    }
                    placeholder="e.g. DungeonMaster99"
                    className="w-full bg-charcoal/50 border border-white/10 rounded-2xl py-4 px-6 text-white font-bold focus:outline-none focus:border-emerald-accent/50 transition-all"
                    required
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {usernameStatus === "checking" && (
                      <Loader2 className="w-4 h-4 text-white/20 animate-spin" />
                    )}
                    {usernameStatus === "available" && (
                      <Check className="w-4 h-4 text-emerald-400" />
                    )}
                    {usernameStatus === "taken" && (
                      <X className="w-4 h-4 text-rose-400" />
                    )}
                  </div>
                </div>
                <div className="mt-2 ml-1 flex flex-col gap-1">
                  <p className="text-[10px] text-gold-accent font-black uppercase tracking-wider">
                    Choose wisely! Your username is permanent and cannot be
                    changed later.
                  </p>
                  {usernameStatus === "taken" && (
                    <p className="text-[10px] text-rose-400 font-bold">
                      This username is already claimed.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-2 ml-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-charcoal/50 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-white font-bold focus:outline-none focus:border-emerald-accent/50 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-2 ml-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-charcoal/50 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white font-bold focus:outline-none focus:border-emerald-accent/50 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {isSignUp && (
              <div className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative mt-1">
                    <input
                      type="checkbox"
                      checked={acceptedBeta}
                      onChange={(e) => setAcceptedBeta(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={cn(
                        "w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center",
                        acceptedBeta
                          ? "bg-emerald-accent border-emerald-accent"
                          : "border-white/10 bg-charcoal/50 group-hover:border-emerald-accent/50",
                      )}
                    >
                      {acceptedBeta && (
                        <Check className="w-3 h-3 text-charcoal font-black" />
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-white/40 font-bold leading-tight select-none">
                    CritShelf is currently in early testing mode. By signing up,
                    you acknowledge that you may encounter bugs, errors, or data
                    resets.
                  </span>
                </label>
              </div>
            )}

            {authError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-400 text-xs font-bold animate-shake">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={
                authLoading ||
                (isSignUp && (!acceptedBeta || usernameStatus !== "available"))
              }
              className="w-full bg-emerald-accent hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-charcoal font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest mt-4"
            >
              {authLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isSignUp ? (
                "Sign Up"
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">
              Or Continue With
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            onClick={signInWithGoogle}
            className="w-full mt-6 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl border border-white/10 transition-all flex items-center justify-center gap-3"
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              className="w-5 h-5"
              alt="Google"
            />
            Continue with Google
          </button>

          <p className="mt-8 text-xs font-bold text-white/30">
            {isSignUp
              ? "Already have an account?"
              : "Don't have an account yet?"}{" "}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError("");
              }}
              className="text-emerald-accent hover:underline"
            >
              {isSignUp ? "Sign In" : "Join Now"}
            </button>
          </p>
        </motion.div>
      </div>
    );
  }

  const stats = [
    {
      label: "Games",
      value: gamesCount.toString(),
      icon: Dices,
      color: "bg-emerald-400",
      to: "/collection",
    },
    {
      label: "Groups",
      value: groupsCount.toString(),
      icon: LayoutGrid,
      color: "bg-indigo-400",
      to: "/social?tab=groups",
    },
    {
      label: "Wins",
      value: winsCount.toString(),
      icon: Trophy,
      color: "bg-rose-400",
      to: "/all-plays",
    },
  ];

  const menuItems = [
    {
      label: "My Friends",
      icon: Users,
      color: "text-indigo-600",
      to: "/social?tab=friends",
    },
    {
      label: "My Groups",
      icon: LayoutGrid,
      color: "text-emerald-600",
      to: "/social?tab=groups",
    },
    {
      label: "Account Settings",
      icon: Settings,
      color: "text-indigo-600",
      to: "/settings/account",
    },
    {
      label: "Privacy & Security",
      icon: Shield,
      color: "text-emerald-600",
      to: "/settings/privacy",
    },
    {
      label: "Notifications",
      icon: Mail,
      color: "text-rose-600",
      to: "/settings/preferences",
    },
  ];

  return (
    <div className="min-h-screen bg-charcoal pb-24 md:pt-20">
      {/* Header / Cover */}
      <div className="h-48 bg-charcoal relative">
        <div className="absolute top-6 right-6 z-20">
          <button
            onClick={() => navigate("/settings")}
            className="w-12 h-12 bg-charcoal/40 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/10 hover:bg-emerald-accent/10 hover:border-emerald-accent/30 transition-all group"
          >
            <Settings className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
          </button>
        </div>
        <div className="absolute inset-0 opacity-20">
          <img
            src="https://picsum.photos/seed/pattern/1920/400"
            className="w-full h-full object-cover blur-sm"
            alt="Cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal to-transparent" />
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-20 relative z-10">
        {/* Profile Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-8 border border-white/10 mb-8"
        >
          <div className="flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
            <div className="relative group">
              <UserAvatar
                user={profile || user}
                size="xl"
                className="rounded-[2rem] border-2 border-white/10 shadow-lg"
              />
              <button
                onClick={() => {
                  const isGoogle =
                    user?.providerData[0]?.providerId === "google.com";
                  setLocalAvatarPreference(
                    profile?.avatarPreference ||
                      (isGoogle ? "google" : "dicebear"),
                  );
                  setLocalAvatarSeed(
                    profile?.avatarSeed ||
                      user?.uid ||
                      Math.random().toString(36).substring(7),
                  );
                  setShowAvatarModal(true);
                }}
                className="absolute bottom-0 right-0 bg-emerald-accent text-charcoal p-2 rounded-xl shadow-lg hover:scale-110 transition-transform"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1">
              <div className="flex flex-col md:flex-row items-center md:items-end gap-3 mb-1">
                <h1 className="text-4xl font-black text-white tracking-tight">
                  {profile?.displayName || user?.displayName || "Gamer"}
                </h1>
                <ACBadge
                  value={profile?.attackClass}
                  size="md"
                  className="mb-2"
                />
              </div>
              <div className="flex flex-col gap-1 mb-4">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <button
                    onClick={() => setShowTitleModal(true)}
                    className="group flex items-center gap-2 bg-emerald-accent/10 px-3 py-1 rounded-full text-xs uppercase tracking-widest border border-emerald-accent/20 hover:border-emerald-accent/50 hover:bg-emerald-accent/20 transition-all text-emerald-accent font-bold"
                  >
                    {profile?.profileTitle || "Master Strategist"}
                    <ChevronDown className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </button>
                  {profile?.location && (
                    <span className="flex items-center gap-1 text-white/40 text-xs font-bold">
                      <MapPin className="w-3 h-3" /> {profile.location}
                    </span>
                  )}
                </div>
                {profile?.bio && (
                  <p className="text-white/60 text-sm font-medium italic max-w-md">
                    "{profile.bio}"
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <button
                  onClick={() => {
                    setEditName(
                      profile?.displayName || user?.displayName || "",
                    );
                    setEditBio(profile?.bio || "");
                    setEditLocation(profile?.location || "");
                    setShowEditModal(true);
                  }}
                  className="bg-emerald-accent text-charcoal px-6 py-2.5 rounded-xl font-bold shadow-lg hover:shadow-emerald-accent/20 transition-all active:scale-95"
                >
                  Edit Profile
                </button>
                <button
                  onClick={signOut}
                  className="bg-white/5 text-white/40 px-6 py-2.5 rounded-xl font-bold hover:bg-white/10 transition-colors flex items-center gap-2 border border-white/10"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mt-10">
            {stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                whileHover={{ y: -5 }}
                onClick={() => stat.to && navigate(stat.to)}
                className={cn(
                  "p-4 rounded-3xl text-center flex flex-col items-center justify-center gap-2 border border-white/5 bg-white/5 transition-all cursor-pointer shadow-xl",
                  stat.to
                    ? "hover:bg-emerald-accent/5 hover:border-emerald-accent/30"
                    : "hover:bg-white/10 hover:border-white/10",
                )}
              >
                <div
                  className={cn(
                    "p-2 rounded-xl text-charcoal shadow-sm",
                    stat.color.replace("bg-", "bg-"),
                  )}
                >
                  <stat.icon className="w-5 h-5" />
                </div>
                <span className="text-2xl font-black text-white">
                  {stat.value}
                </span>
                <span className="text-[10px] uppercase font-black tracking-widest text-white/30">
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Top Shelf Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-6 px-2">
            <div className="w-8 h-8 bg-gold-accent/10 rounded-lg flex items-center justify-center border border-gold-accent/20">
              <Star className="w-4 h-4 text-gold-accent fill-gold-accent" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">
              The Top Shelf
            </h2>
          </div>
          
          <div className="grid grid-cols-3 gap-4 md:gap-6">
            {[0, 1, 2].map((index) => {
              const favorite = favorites[index];
              if (favorite) {
                return (
                  <motion.div
                    key={favorite.gameId}
                    whileHover={{ y: -8 }}
                    onClick={() => navigate(`/game/${favorite.gameId}`)}
                    className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-charcoal border border-gold-accent/20 shadow-[0_0_30px_rgba(251,191,36,0.1)] group cursor-pointer"
                  >
                    {/* Blurred Art Background Layer */}
                    <div className="absolute inset-0 overflow-hidden">
                      <img
                        src={favorite.gameCover || undefined}
                        alt=""
                        className={cn(
                          "absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-150",
                          (favorite.customImageApproved || favorite.isApproved)
                            ? "opacity-100 filter-none"
                            : "blur-2xl scale-125",
                        )}
                        referrerPolicy="no-referrer"
                      />
                      {/* Dark Overlay only if not approved so it doesn't hide good art, or lighter if approved */}
                      <div
                        className={cn(
                          "absolute inset-0 transition-colors",
                          (favorite.customImageApproved || favorite.isApproved)
                            ? "bg-gradient-to-t from-gray-900/80 via-transparent to-transparent group-hover:bg-gray-900/20"
                            : "bg-gray-900/60 group-hover:bg-gray-900/40",
                        )}
                      />
                    </div>

                    {/* Foreground Content (Centered Title, only show if no art) */}
                    <div className="relative z-10 flex flex-col items-center justify-center h-full p-6 text-center pointer-events-none">
                      {!(favorite.customImageApproved || favorite.isApproved) && (
                        <h3 className="text-sm md:text-base font-black text-white uppercase tracking-tighter leading-tight line-clamp-3 drop-shadow-lg max-w-[80%]">
                          {favorite.gameTitle}
                        </h3>
                      )}

                      <div className="absolute bottom-3 right-3 transform transition-transform group-hover:scale-110 pointer-events-auto">
                        <D20Die
                          value={favorite.rating}
                          theme={favorite.isPersonal ? "gold" : "outline"}
                          size="xs"
                          className="shadow-2xl"
                        />
                      </div>

                      {/* Tooltip (View Game Intel) */}
                      <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full whitespace-nowrap">
                          <p className="text-[8px] font-black text-white uppercase tracking-widest leading-none">
                            View Game
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              }

              return (
                <button
                  key={`empty-${index}`}
                  onClick={() => setShowSearch(true)}
                  className="aspect-[2/3] rounded-2xl border-2 border-dashed border-emerald-accent/20 bg-emerald-accent/5 flex flex-col items-center justify-center gap-3 group hover:border-emerald-accent/40 hover:bg-emerald-accent/10 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6 text-emerald-accent" />
                  </div>
                  <span className="text-[10px] uppercase font-black tracking-widest text-emerald-accent/40 group-hover:text-emerald-accent/60">
                    Add Favorite
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Recent Activity Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 rounded-[2.5rem] shadow-2xl p-8 border border-white/10 mb-8"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-accent/10 rounded-2xl flex items-center justify-center border border-emerald-accent/20">
                <History className="w-6 h-6 text-emerald-accent" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Recent Activity
              </h2>
            </div>
            <button
              onClick={() => navigate("/activity-log")}
              className="text-sm font-black text-emerald-accent hover:bg-emerald-accent/10 px-4 py-2 rounded-xl transition-all"
            >
              View All
            </button>
          </div>

          <div className="space-y-4">
            {activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}

            {activities.length > 0 && (
              <button
                onClick={() => navigate("/activity-log")}
                className="w-full py-4 rounded-2xl border-2 border-emerald-accent/30 text-emerald-accent font-black hover:bg-emerald-accent/5 transition-all flex items-center justify-center gap-2 group"
              >
                View Full Activity Feed
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            )}
            {activities.length === 0 && (
              <div className="text-center py-12">
                <p className="text-white/20 font-bold">
                  No activity recorded yet.
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Menu List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 rounded-[2rem] p-6 shadow-2xl border border-white/10"
          >
            <h3 className="text-xl font-black text-white mb-6 px-2">
              Preferences
            </h3>
            <div className="space-y-2">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => item.to && navigate(item.to)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 group transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "p-2 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors",
                        item.color.replace("text-", "text-"),
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-white/70 group-hover:text-white transition-colors">
                      {item.label}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/10 group-hover:text-emerald-accent transition-colors" />
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gold-accent rounded-[2rem] p-8 text-charcoal shadow-2xl relative overflow-hidden group"
          >
            <div className="relative z-10">
              <h3 className="text-2xl font-black mb-2">Pro Member</h3>
              <p className="text-charcoal/70 text-sm mb-6 leading-relaxed opacity-90">
                Unlock exclusive badges, unlimited collection slots, and early
                access to new features!
              </p>
              <button
                disabled
                className="bg-charcoal text-white px-6 py-3 rounded-2xl font-black shadow-lg opacity-70 cursor-not-allowed transition-all"
              >
                Coming Soon
              </button>
            </div>
            <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-500">
              <Trophy className="w-48 h-48" />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-charcoal/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white/5 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    Edit Profile
                  </h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-white/30 mb-3 ml-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Your name"
                      className="w-full bg-charcoal border border-white/10 rounded-2xl py-4 px-6 text-white font-bold focus:outline-none focus:border-emerald-accent/50 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-white/30 mb-3 ml-1">
                      Gamer Tagline / Bio
                    </label>
                    <textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value.slice(0, 150))}
                      placeholder="Tell us about your gaming style..."
                      rows={3}
                      className="w-full bg-charcoal border border-white/10 rounded-2xl py-4 px-6 text-white font-bold focus:outline-none focus:border-emerald-accent/50 transition-all resize-none"
                    />
                    <div className="flex justify-end mt-1">
                      <span
                        className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          editBio.length >= 150
                            ? "text-rose-400"
                            : "text-white/20",
                        )}
                      >
                        {editBio.length}/150
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-white/30 mb-3 ml-1">
                      Home City
                    </label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      placeholder="e.g. Seattle, WA"
                      className="w-full bg-charcoal border border-white/10 rounded-2xl py-4 px-6 text-white font-bold focus:outline-none focus:border-emerald-accent/50 transition-all"
                    />
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile || !editName.trim()}
                    className="w-full bg-gold-accent hover:bg-gold-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-charcoal font-black py-4 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    {savingProfile ? (
                      <div className="w-5 h-5 border-2 border-charcoal border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>Save Changes</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Avatar Modal */}
      <AnimatePresence>
        {showAvatarModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAvatarModal(false)}
              className="absolute inset-0 bg-charcoal/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white/5 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    Update Avatar
                  </h2>
                  <button
                    onClick={() => setShowAvatarModal(false)}
                    className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-8">
                  <div className="flex flex-col items-center gap-6 py-4">
                    <UserAvatar
                      user={{
                        photoURL: user?.photoURL,
                        avatarPreference: localAvatarPreference,
                        avatarSeed: localAvatarSeed,
                        uid: user?.uid,
                      }}
                      size="xl"
                      className="border-4 border-emerald-accent/20 shadow-2xl"
                    />

                    {localAvatarPreference === "dicebear" && (
                      <button
                        onClick={() =>
                          setLocalAvatarSeed(
                            Math.random().toString(36).substring(7),
                          )
                        }
                        className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black text-white/60 hover:text-white transition-all group"
                      >
                        <Dices className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                        Reroll Avatar
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setLocalAvatarPreference("google")}
                      disabled={
                        user?.providerData[0]?.providerId !== "google.com" ||
                        !user?.photoURL
                      }
                      className={cn(
                        "flex flex-col items-center gap-3 p-6 rounded-[2rem] border-2 transition-all",
                        localAvatarPreference === "google"
                          ? "bg-emerald-accent/10 border-emerald-accent text-emerald-accent"
                          : "bg-white/5 border-white/5 text-white/20 hover:bg-white/10",
                        (user?.providerData[0]?.providerId !== "google.com" ||
                          !user?.photoURL) &&
                          "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                        <img
                          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                          className="w-6 h-6"
                          alt="Google"
                        />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-black uppercase tracking-widest transition-all">
                          Google Photo
                        </span>
                        {user?.providerData[0]?.providerId !== "google.com" && (
                          <span className="text-[8px] font-bold text-rose-400 uppercase tracking-tighter">
                            Google Only
                          </span>
                        )}
                      </div>
                    </button>

                    <button
                      onClick={() => setLocalAvatarPreference("dicebear")}
                      className={cn(
                        "flex flex-col items-center gap-3 p-6 rounded-[2rem] border-2 transition-all",
                        localAvatarPreference === "dicebear"
                          ? "bg-emerald-accent/10 border-emerald-accent text-emerald-accent"
                          : "bg-white/5 border-white/5 text-white/20 hover:bg-white/10",
                      )}
                    >
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                        <Dices className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-widest">
                        Generated
                      </span>
                    </button>
                  </div>

                  <button
                    onClick={handleSaveAvatar}
                    disabled={savingAvatar}
                    className="w-full bg-gold-accent hover:bg-gold-accent/90 disabled:opacity-50 text-charcoal font-black py-5 rounded-[2rem] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    {savingAvatar ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-6 h-6" /> Save Selection
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Title Selection Modal */}
      <AnimatePresence>
        {showTitleModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTitleModal(false)}
              className="absolute inset-0 bg-charcoal/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white/5 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    Select Title
                  </h2>
                  <button
                    onClick={() => setShowTitleModal(false)}
                    className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {TITLE_OPTIONS.map((titleOption) => (
                    <button
                      key={titleOption}
                      onClick={() => handleUpdateTitle(titleOption)}
                      disabled={updatingTitle}
                      className={cn(
                        "w-full text-left px-5 py-4 rounded-2xl font-bold transition-all flex items-center justify-between group",
                        (profile?.profileTitle || "Master Strategist") ===
                          titleOption
                          ? "bg-gold-accent text-charcoal shadow-lg shadow-gold-accent/20"
                          : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <span>{titleOption}</span>
                      {updatingTitle &&
                      (profile?.profileTitle || "Master Strategist") ===
                        titleOption ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (profile?.profileTitle || "Master Strategist") ===
                        titleOption ? (
                        <Trophy className="w-4 h-4" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Search Modal */}
      <AnimatePresence>
        {showSearch && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSearch(false)}
              className="absolute inset-0 bg-charcoal/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white/5 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    Add to Top Shelf
                  </h2>
                  <button
                    onClick={() => setShowSearch(false)}
                    className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="relative mb-8">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for a game..."
                    className="w-full bg-charcoal border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-white font-bold focus:outline-none focus:border-emerald-accent/50 transition-all"
                  />
                  {(searching ||
                    (searchQuery !== debouncedSearchQuery &&
                      searchQuery.trim())) && (
                    <div className="absolute right-5 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 text-emerald-accent animate-spin" />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {searching ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="w-8 h-8 border-4 border-emerald-accent border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((game) => (
                      <button
                        key={game.id}
                        onClick={() => addFavorite(game)}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-emerald-accent/30 hover:bg-emerald-accent/5 transition-all group text-left"
                      >
                        <div className="w-16 h-20 rounded-lg overflow-hidden shrink-0">
                          <img
                            src={game.coverImage || undefined}
                            alt={game.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-black text-white group-hover:text-emerald-accent transition-colors">
                            {game.title}
                          </h4>
                          <p className="text-xs text-white/30 font-bold uppercase tracking-widest mt-1">
                            Tap to add
                          </p>
                        </div>
                        <Plus className="w-5 h-5 text-white/20 group-hover:text-emerald-accent transition-colors" />
                      </button>
                    ))
                  ) : searchQuery && !searching ? (
                    <div className="text-center py-10">
                      <p className="text-white/20 font-bold">
                        No games found matching "{searchQuery}"
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-white/20 font-bold">
                        Search for your favorite games to display them on your
                        Top Shelf.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
