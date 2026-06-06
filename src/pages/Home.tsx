import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Plus,
  Users,
  Dices,
  ChevronRight,
  ChevronLeft,
  Star,
  Activity as ActivityIcon,
  MessageCircle,
  Loader2,
  Quote,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { db, OperationType, handleFirestoreError } from "../lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  orderBy,
  doc,
  getDoc,
  onSnapshot,
  or,
  and,
  documentId,
  updateDoc,
} from "firebase/firestore";
import { cn } from "../lib/utils";
import D20Die from "../components/D20Die";
import GameTitleWithDC from "../components/GameTitleWithDC";
import LogPlayModal from "../components/LogPlayModal";
import ACBadge from "../components/ACBadge";
import UserAvatar from "../components/UserAvatar";

const GameCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={cn(
      "animate-pulse bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden",
      className,
    )}
  >
    <div className="h-48 w-full relative flex items-center justify-between px-4 sm:px-6">
      <div className="w-11 h-11 sm:w-14 sm:h-14 bg-white/10 rounded-full" />
      <div className="flex-1 px-4 space-y-3">
        <div className="h-4 bg-white/10 rounded-full w-3/4 mx-auto" />
        <div className="h-8 bg-white/10 rounded-2xl w-full" />
        <div className="h-3 bg-white/10 rounded-full w-1/2 mx-auto" />
      </div>
      <div className="w-11 h-11 sm:w-14 sm:h-14 bg-white/10 rounded-full" />
    </div>
  </div>
);

import GameCard, { Game } from "../components/GameCard";
import { useUser } from "../contexts/UserContext";
import ActivityItem from "../components/ActivityItem";

interface RotationGame extends Game {
  playCount: number;
}

interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  gameId: string;
  gameTitle: string;
  gameCover: string;
  score: number;
  text?: string;
  createdAt: any;
  attackClass?: number;
}

import { useRecentGames } from "../hooks/useRecentGames";

export default function Home() {
  const { profile, user, groupRatings, friendsRatings } = useUser();
  const [rotationGames, setRotationGames] = useState<RotationGame[]>([]);
  const [rotationIndex, setRotationIndex] = useState(0);
  const { recentGames, loading: loadingRecent } = useRecentGames();
  const [friendReviews, setFriendReviews] = useState<any[]>([]);

  const [loadingRotation, setLoadingRotation] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const navigate = useNavigate();

  const hasTriggeredBackfill = useRef(false);

  // BACKFILL FIX - RUN ONCE
  useEffect(() => {
    if (!user) return;
    if (hasTriggeredBackfill.current) return;
    hasTriggeredBackfill.current = true;

    const runBackfill = async () => {
      const lockKey = "backfill_run_groups_11_and_plays_2";
      if (localStorage.getItem(lockKey)) return;
      localStorage.setItem(lockKey, "1");

      console.log("Running automatic retro-active backfills...");
      
      try {
        const groupsRef = collection(db, "groups");
        const groupsSnap = await getDocs(groupsRef);
        let count = 0;
        
        for (const groupDoc of groupsSnap.docs) {
          const data = groupDoc.data();
          if (!data.memberIds && data.members) {
            console.log("Fixing group:", groupDoc.id);
            const memberIds = data.members.map((m: any) => typeof m === "string" ? m : m.userId);
            await updateDoc(groupDoc.ref, { memberIds });
            count++;
          }
        }
        console.log(`Backfilled ${count} groups with memberIds.`);
      } catch (err) {
        console.error("Group memberIds backfill failed:", err);
      }

      try {
        // 1. Fetch recent plays
        const playsRef = collection(db, "plays");
        const playsSnap = await getDocs(query(playsRef, orderBy("createdAt", "desc"), limit(20)));

        // 2. Fetch actor's followers (users who have actor in their following array)
        const usersRef = collection(db, "users");
        const followersQ = query(usersRef, where("following", "array-contains", user.uid));
        const followersSnap = await getDocs(followersQ);
        const followerIds = followersSnap.docs.map(d => d.id);
        const audienceIds = [...new Set([user.uid, ...followerIds])];

        // 2.5 Fix actorName on all past activities just in case they were set to Anonymous or Unknown
        const correctName = profile?.displayName || profile?.username || user.displayName || "Anonymous";
        const myActivitiesQ = query(collection(db, "activities"), where("actorId", "==", user.uid));
        const myActSnap = await getDocs(myActivitiesQ);
        for (const docSnap of myActSnap.docs) {
          if (docSnap.data().actorName !== correctName) {
             const { updateDoc } = await import("firebase/firestore");
             await updateDoc(docSnap.ref, { actorName: correctName });
          }
        }

        for (const pd of playsSnap.docs) {
          const playData = pd.data();
          if (playData.userId === user.uid) {
            // Did this play get an activity?
            const actRef = collection(db, "activities");
            const qAct = query(actRef, where("metadata.playId", "==", pd.id), limit(1));
            const actSnap = await getDocs(qAct);
            
            if (actSnap.empty) {
              console.log("Found missing activity for play:", playData.gameTitle);
              // Backfill it!
              const { logSocialActivity } = await import("../lib/socialActivityLogger");
              await logSocialActivity({
                type: "LOG_PLAY",
                actorId: user.uid,
                actorName: profile?.displayName || profile?.username || user.displayName || "Anonymous",
                targetId: playData.gameId,
                targetName: playData.gameTitle,
                metadata: {
                  playId: pd.id,
                  gameCover: playData.gameCover || "",
                  isArtApproved: playData.isArtApproved || false,
                  score: playData.rating,
                  winners: playData.winners || [],
                },
              });
            } else {
               // Update audienceIds on existing activity
               const actDoc = actSnap.docs[0];
               const actData = actDoc.data();
               const currentAuds = actData.audienceIds || [];
               if (actData.actorId === user.uid && (!currentAuds.includes(user.uid) || currentAuds.length < audienceIds.length)) {
                 const { updateDoc } = await import("firebase/firestore");
                 await updateDoc(actDoc.ref, { audienceIds });
               }
            }
          }
        }
      } catch (err: any) {
        console.error("Backfill failed:", err?.message || err);
        console.error("Backfill failed code:", err?.code);
      }
    };
    runBackfill();
  }, [user?.uid]);


  useEffect(() => {
    // 2. Plays -> Rotation (Real-time, depends on user)
    if (!user) {
      setLoadingRotation(false);
      setRotationGames([]);
      return;
    }

    let unsubscribeRotation: (() => void)[] = [];
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // REDUCED TO 50 TO PREVENT READ LEAKS
    console.warn(
      "Firestore index warning: If 'Heavy Rotation' (Home page) fails to load, ensure you have " +
        "created a composite index for collection 'plays' with: userIds (Array) and " +
        "playDate (Ascending/Descending) in the Firebase console.",
    );
    const qPlays = query(
      collection(db, "plays"),
      and(
        where("userIds", "array-contains", user.uid),
        where("playDate", ">=", oneYearAgo),
      ),
      limit(50),
    );

    const fetchRotation = async () => {
      try {
        const playsSnap = await getDocs(qPlays);
        const playCounts: Record<string, number> = {};
        const playMetadata: Record<string, any> = {};

        playsSnap.docs.forEach((d) => {
          const data = d.data();
          playCounts[data.gameId] = (playCounts[data.gameId] || 0) + 1;
          if (!playMetadata[data.gameId]) {
            playMetadata[data.gameId] = {
              title: data.gameTitle || "Unknown Game",
              coverImage: data.gameCover || "",
              isArtApproved: data.isArtApproved || false,
            };
          }
        });

        const sortedGameIds = Object.entries(playCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10);

        if (sortedGameIds.length === 0) {
          setRotationGames([]);
          setLoadingRotation(false);
          return;
        }

        const topGameIdsArray = sortedGameIds.map(([id]) => id);
        if (!topGameIdsArray || topGameIdsArray.length === 0) return;
        console.log("1. IDs sent to Firebase:", topGameIdsArray);

        const qGames = query(
          collection(db, "games"),
          where(documentId(), "in", topGameIdsArray),
        );
        const gamesSnap = await getDocs(qGames);
        console.log(
          "2. Raw Firebase Data:",
          gamesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );

        const gamesMap = new Map();
        gamesSnap.docs.forEach((doc) => gamesMap.set(doc.id, doc.data()));

        const gamesResults = sortedGameIds.map(([id, count]) => {
          const gameData = gamesMap.get(id) || {};
          const meta = playMetadata[id] || {};

          return {
            id,
            ...meta,
            ...gameData,
            playCount: count,
          } as RotationGame;
        });

        const finalGamesList = gamesResults.slice(0, 3) as RotationGame[];
        setRotationGames(finalGamesList);
      } catch (error) {
        console.error("Firebase Query Error:", error);
      } finally {
        setLoadingRotation(false);
      }
    };

    fetchRotation();
  }, [user?.uid]);

  useEffect(() => {
    // 3. Friends' Recent Plays (Personal Dashboard View)
    if (!user) {
      setFriendReviews([]);
      setLoadingReviews(false);
      return;
    }

    let unsubscribeFallback: (() => void) | undefined;
    let isSubscribed = true;

    const qPlays = query(
      collection(db, "activities"),
      where("audienceIds", "array-contains", user.uid),
      where("type", "==", "LOG_PLAY"),
      orderBy("createdAt", "desc"),
      limit(5)
    );

    const mapSnapToReviews = async (snap: any, isFallback = false) => {
      try {
        let reviewsRaw = snap.docs.map((d: any) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));

        if (isFallback) {
          reviewsRaw = reviewsRaw.filter((r: any) => r.type === "LOG_PLAY").slice(0, 5);
        }

        const gameIds = reviewsRaw.map((r: any) => r.targetId).filter(Boolean);
        const uniqueGameIds = Array.from(new Set(gameIds)).slice(0, 10);
        
        const gamesMap = new Map();
        if (uniqueGameIds.length > 0) {
          const gamesQ = query(collection(db, "games"), where(documentId(), "in", uniqueGameIds));
          const gamesSnap = await getDocs(gamesQ);
          gamesSnap.docs.forEach((doc) => gamesMap.set(doc.id, doc.data()));
        }

        const activityList = reviewsRaw.map((r: any) => {
          const gameData = gamesMap.get(r.targetId) || {};
          return {
            id: r.id,
            userId: r.actorId,
            userName: r.actorName,
            avatarSeed: r.actorId,
            type: 'LOG_PLAY',
            timestamp: r.createdAt,
            metadata: {
              ...r.metadata,
              gameId: r.targetId,
              playId: r.metadata?.playId,
              gameTitle: gameData.title || r.targetName || r.metadata?.gameTitle || "Unknown Game",
              coverImage: gameData.coverImage || r.metadata?.gameCover || r.metadata?.coverImage || "",
              gameCover: gameData.coverImage || r.metadata?.gameCover || r.metadata?.coverImage || "",
              isApproved: gameData.isApproved ?? true,
              customImageApproved: gameData.customImageApproved ?? true,
              score: r.metadata?.score,
              text: r.metadata?.text,
              location: r.metadata?.location,
              players: r.metadata?.players,
            }
          };
        });

        console.log("FRIENDS PLAYS ACTIVITY LIST:", activityList);

        if (isSubscribed) {
          setFriendReviews(activityList);
          setLoadingReviews(false);
        }
      } catch (err) {
        console.error("Error processing friends plays:", err);
        if (isSubscribed) setLoadingReviews(false);
      }
    };

    const unsubscribe = onSnapshot(
      qPlays,
      (snap) => {
        mapSnapToReviews(snap, false);
      },
      (error) => {
        console.error("Friends Plays Fetch Error, falling back:", error);
        
        const qPlaysFallback = query(
          collection(db, "activities"),
          orderBy("createdAt", "desc"),
          limit(20)
        );

        unsubscribeFallback = onSnapshot(
          qPlaysFallback,
          (fallbackSnap) => {
            // Sort in memory to avoid missing index on audienceIds + timestamp
            const filteredDocs = fallbackSnap.docs.filter((d) => {
              const aud = d.data().audienceIds || [];
              return aud.includes(user.uid);
            });
            const docs = filteredDocs.sort((a, b) => {
               const tA = a.data({ serverTimestamps: 'estimate' }).createdAt?.toMillis?.() || a.data({ serverTimestamps: 'estimate' }).timestamp?.toMillis?.() || 0;
               const tB = b.data({ serverTimestamps: 'estimate' }).createdAt?.toMillis?.() || b.data({ serverTimestamps: 'estimate' }).timestamp?.toMillis?.() || 0;
               return tB - tA;
            }).slice(0, 5);
            mapSnapToReviews({ docs }, true);
          },
          (fallbackError) => {
            console.error("Fallback Friends Plays Fetch Error:", fallbackError);
            if (isSubscribed) setLoadingReviews(false);
          }
        );
      }
    );

    return () => {
      isSubscribed = false;
      unsubscribe();
      if (unsubscribeFallback) unsubscribeFallback();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (rotationGames.length > 0 && rotationIndex >= rotationGames.length) {
      setRotationIndex(rotationGames.length - 1);
    }
  }, [rotationGames]);

  // Removed global loading check to allow shell to render instantly

  return (
    <div className="min-h-screen bg-charcoal pt-4 pb-32 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Step 1: The "Heavy Rotation" Section */}
        <section>
          <div className="flex items-center justify-between mb-6 px-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-accent/10 rounded-lg flex items-center justify-center border border-emerald-accent/20">
                <ActivityIcon className="w-4 h-4 text-emerald-accent" />
              </div>
              <h2 className="text-xl font-black text-white tracking-tight uppercase tracking-widest text-[10px]">
                Your Heavy Rotation
              </h2>
            </div>
            {user && (
              <Link
                to="/collection"
                className="text-[10px] font-black uppercase tracking-widest text-emerald-accent hover:text-white transition-colors"
              >
                Full Collection →
              </Link>
            )}
          </div>

          <div className="space-y-6">
            {!user ? (
              <div className="bg-white/5 border border-white/10 rounded-[3rem] p-10 text-center">
                <ActivityIcon className="w-12 h-12 text-emerald-accent/20 mx-auto mb-4" />
                <h3 className="text-xl font-black text-white mb-2">
                  Track Your Rotation
                </h3>
                <p className="text-white/40 font-medium mb-8 max-w-sm mx-auto">
                  Sign up to track your rolling play history and identify your
                  table's heavy favorites.
                </p>
                <button
                  onClick={() => navigate("/auth")}
                  className="bg-emerald-accent text-charcoal px-8 py-3 rounded-2xl font-black text-sm shadow-lg hover:shadow-emerald-accent/20 transition-all hover:scale-105"
                >
                  Get Started
                </button>
              </div>
            ) : loadingRotation ? (
              <div className="relative">
                <GameCardSkeleton />
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="w-2 h-2 rounded-full bg-white/5" />
                  ))}
                </div>
              </div>
            ) : rotationGames.length > 0 ? (
              <div className="relative group">
                <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {rotationGames.map((game, idx) => (
                    <div
                      key={game.id}
                      className={cn(
                        "min-w-[85vw] md:min-w-0 md:w-full shrink-0 snap-center",
                        // Keep Desktop behavior functionally tied to rotationIndex
                        idx !== rotationIndex ? "md:hidden" : "md:block",
                      )}
                    >
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={game.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.3 }}
                          className="relative"
                        >
                          <GameCard
                            game={game}
                            personalRating={profile?.ratings?.[game.id]}
                            groupRating={groupRatings[game.id]?.rating}
                            friendsRating={friendsRatings[game.id]}
                            groupName={groupRatings[game.id]?.groupName}
                            isRecentPlay={true}
                            playCount={game.playCount}
                          />
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  ))}
                </div>

                {/* Carousel Paging Arrows */}
                {rotationIndex > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setRotationIndex((prev) => prev - 1);
                    }}
                    className="hidden md:flex absolute -left-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-charcoal/80 backdrop-blur-md rounded-full border border-white/10 items-center justify-center text-white hover:bg-emerald-accent hover:text-charcoal transition-all shadow-2xl active:scale-95 group/btn"
                  >
                    <ChevronLeft className="w-6 h-6 group-hover/btn:-translate-x-1 transition-transform" />
                  </button>
                )}

                {rotationIndex < rotationGames.length - 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setRotationIndex((prev) => prev + 1);
                    }}
                    className="hidden md:flex absolute -right-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-charcoal/80 backdrop-blur-md rounded-full border border-white/10 items-center justify-center text-white hover:bg-emerald-accent hover:text-charcoal transition-all shadow-2xl active:scale-95 group/btn"
                  >
                    <ChevronRight className="w-6 h-6 group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                )}

                {/* Carousel Dots Indicator */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                  {rotationGames.map((_, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all duration-300 md:block hidden",
                        idx === rotationIndex
                          ? "bg-emerald-accent w-6"
                          : "bg-white/10",
                      )}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-20 bg-white/5 rounded-[3rem] border-2 border-dashed border-white/10">
                <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/10">
                  <Dices className="w-8 h-8 text-white/10" />
                </div>
                <h3 className="text-xl font-black text-white mb-2">
                  No Plays Yet
                </h3>
                <p className="text-white/30 font-bold">
                  Log Plays to Start your Rotation
                </p>
                <button
                  onClick={() => setIsLogModalOpen(true)}
                  className="mt-8 bg-emerald-accent/10 text-emerald-accent px-8 py-3 rounded-2xl font-black text-sm hover:bg-emerald-accent hover:text-charcoal transition-all border border-emerald-accent/20"
                >
                  Record Your First Play
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Step 2: The Quick-Action Bar */}
        {user && (
          <section className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setIsLogModalOpen(true)}
              className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex flex-col items-center gap-3 hover:bg-white/10 transition-all group"
            >
              <div className="w-12 h-12 bg-emerald-accent/10 rounded-2xl flex items-center justify-center border border-emerald-accent/20 group-hover:scale-110 transition-transform">
                <Dices className="w-6 h-6 text-emerald-accent" />
              </div>
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest text-center">
                Record Play
              </span>
            </button>

            <button
              onClick={() => navigate("/browse")}
              className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex flex-col items-center gap-3 hover:bg-white/10 transition-all group"
            >
              <div className="w-12 h-12 bg-emerald-accent/10 rounded-2xl flex items-center justify-center border border-emerald-accent/20 group-hover:scale-110 transition-transform">
                <Search className="w-6 h-6 text-emerald-accent" />
              </div>
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest text-center">
                Find Game
              </span>
            </button>

            <button
              onClick={() => navigate("/social")}
              className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex flex-col items-center gap-3 hover:bg-white/10 transition-all group"
            >
              <div className="w-12 h-12 bg-emerald-accent/10 rounded-2xl flex items-center justify-center border border-emerald-accent/20 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-emerald-accent" />
              </div>
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest text-center">
                Social Hub
              </span>
            </button>
          </section>
        )}

        {/* Newdiscovery Section: Recently Added to CritShelf */}
        <section className="py-4">
          <div className="flex items-center gap-3 mb-6 px-2">
            <div className="w-8 h-8 bg-gold-accent/10 rounded-lg flex items-center justify-center border border-gold-accent/20">
              <Plus className="w-4 h-4 text-gold-accent" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight uppercase tracking-widest text-[10px]">
              Recently Added to CritShelf
            </h2>
          </div>

          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-6 px-2 items-stretch">
            {loadingRecent ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="min-w-[200px] max-w-[240px] sm:min-w-[240px] shrink-0 snap-start min-h-[12rem] flex-1"
                >
                  <GameCardSkeleton className="h-full" />
                </div>
              ))
            ) : recentGames.length > 0 ? (
              recentGames.slice(0, 5).map((game) => (
                <div key={game.id} className="min-w-[200px] max-w-[240px] sm:min-w-[240px] shrink-0 snap-start flex-1">
                  <GameCard
                    game={game}
                    compact
                    personalRating={profile?.ratings?.[game.id]}
                    groupRating={groupRatings[game.id]?.rating}
                    friendsRating={friendsRatings[game.id]}
                    groupName={groupRatings[game.id]?.groupName}
                  />
                </div>
              ))
            ) : (
              <div className="w-full text-center py-12 bg-white/5 rounded-[2.5rem] border border-dashed border-white/10">
                <p className="text-white/20 font-bold text-sm uppercase tracking-widest">
                  No Discovery Feed Available
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Step 3: Recent Ratings Feed */}
        <section>
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-accent/10 rounded-lg flex items-center justify-center border border-emerald-accent/20">
                <Dices className="w-4 h-4 text-emerald-accent" />
              </div>
              <h2 className="text-xl font-black text-white tracking-tight uppercase tracking-widest text-[10px]">
                Friends' Recent Plays
              </h2>
            </div>
          </div>

          <div className="flex flex-row overflow-x-auto snap-x snap-mandatory gap-4 pb-4 items-stretch px-2 no-scrollbar mb-8">
            {!user ? (
              <div className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center shrink-0 snap-center">
                <Users className="w-10 h-10 text-emerald-accent/20 mx-auto mb-3" />
                <h3 className="text-lg font-black text-white mb-2">
                  See Friends' Plays
                </h3>
                <p className="text-white/40 text-sm font-medium mb-6">
                  Log in to see what your friends are playing.
                </p>
                <button
                  onClick={() => navigate("/auth")}
                  className="w-full max-w-xs mx-auto py-3 rounded-xl border border-emerald-accent/20 text-emerald-accent font-black text-[10px] uppercase tracking-widest hover:bg-emerald-accent hover:text-charcoal transition-all block"
                >
                  Login to view
                </button>
              </div>
            ) : loadingReviews ? (
              [1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="min-w-[280px] w-full max-w-[320px] shrink-0 snap-start animate-pulse bg-white/5 border border-white/10 rounded-[2.5rem] p-6 h-32 shadow-xl"
                />
              ))
            ) : friendReviews.length > 0 ? (
              friendReviews.map((activity) => (
                <div key={activity.id} className="min-w-[280px] w-full max-w-[320px] shrink-0 snap-start">
                  <ActivityItem activity={activity} compact={false} />
                </div>
              ))
            ) : (
              <div className="w-full text-center py-16 bg-white/5 rounded-[3rem] border-2 border-dashed border-white/10 shrink-0 snap-center">
                <Dices className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <h3 className="text-lg font-black text-white mb-2">
                  No Recent Plays
                </h3>
                <p className="text-white/30 text-sm font-bold max-w-xs mx-auto">
                  Follow some fellow gamers or wait for them to log their next session!
                </p>
                <button
                  onClick={() => navigate("/browse")}
                  className="mt-6 text-gold-accent font-black text-[10px] uppercase tracking-widest hover:underline"
                >
                  Discover new games
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => navigate("/social")}
            className="w-full py-4 rounded-2xl border-2 border-white/10 text-white/40 font-black text-xs uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all flex items-center justify-center gap-2 group"
          >
            See Full Social Hub
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </section>
      </div>

      <LogPlayModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
      />
    </div>
  );
}
