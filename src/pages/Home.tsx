import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Quote
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  orderBy, 
  doc, 
  getDoc,
  onSnapshot
} from 'firebase/firestore';
import { cn } from '../lib/utils';
import D20Die from '../components/D20Die';
import GameTitleWithDC from '../components/GameTitleWithDC';
import LogPlayModal from '../components/LogPlayModal';
import ACBadge from '../components/ACBadge';
import UserAvatar from '../components/UserAvatar';

const GameCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("animate-pulse bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden", className)}>
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

import GameCard, { Game } from '../components/GameCard';
import { useUser } from '../contexts/UserContext';
import ActivityItem from '../components/ActivityItem';

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

export default function Home() {
  const { profile, user, groupRatings } = useUser();
  const [rotationGames, setRotationGames] = useState<RotationGame[]>([]);
  const [rotationIndex, setRotationIndex] = useState(0);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [friendReviews, setFriendReviews] = useState<any[]>([]);
  
  const [loadingRotation, setLoadingRotation] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribePlays: (() => void) | null = null;
    let unsubscribeRecent: (() => void) | null = null;
    let unsubscribeFriends: (() => void) | null = null;
    let unsubscribeRotation: (() => void)[] = [];

    const initDashboard = async () => {
      // 1. Real-time Recent Games
      const qRecent = query(
        collection(db, 'games'),
        where('isApproved', '==', true),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      
      unsubscribeRecent = onSnapshot(qRecent, (snap) => {
        setRecentGames(snap.docs.map(d => ({ id: d.id, ...d.data() } as Game)));
        setLoadingRecent(false);
      }, (error) => {
        console.error("Recent Games Snapshot Error:", error);
        setLoadingRecent(false);
      });

      // 2. Auth-dependent features
      if (user && profile) {
        // A. Plays -> Rotation (Real-time)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        const qPlays = query(
          collection(db, 'plays'),
          where('userId', '==', user.uid),
          where('playDate', '>=', oneYearAgo),
          limit(500)
        );

        unsubscribePlays = onSnapshot(qPlays, async (playsSnap) => {
          try {
            const playCounts: Record<string, number> = {};
            playsSnap.docs.forEach(d => {
              const data = d.data();
              playCounts[data.gameId] = (playCounts[data.gameId] || 0) + 1;
            });

            const sortedGameIds = Object.entries(playCounts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3);

            if (sortedGameIds.length === 0) {
              setRotationGames([]);
              setLoadingRotation(false);
              return;
            }

            const topIds = sortedGameIds.map(([id]) => id);
            
            // Clean up previous individual rotation listeners
            unsubscribeRotation.forEach(un => un());
            unsubscribeRotation = [];

            // Set up onSnapshot for each game in the top rotation to ensure ratings are fresh
            topIds.forEach((id, idx) => {
              const count = sortedGameIds[idx][1];
              const u = onSnapshot(doc(db, 'games', id), (gSnap) => {
                if (gSnap.exists()) {
                  setRotationGames(prev => {
                    const updated = [...prev];
                    const gameWithCount = { id: gSnap.id, ...gSnap.data(), playCount: count } as RotationGame;
                    
                    const existingIdx = updated.findIndex(g => g.id === id);
                    if (existingIdx > -1) {
                      updated[existingIdx] = gameWithCount;
                    } else {
                      updated.push(gameWithCount);
                      // Sort after adding new
                      updated.sort((a, b) => b.playCount - a.playCount);
                    }
                    return updated;
                  });
                }
              });
              unsubscribeRotation.push(u);
            });
          } catch (error) {
            console.error("Error in Rotation Aggregation:", error);
          } finally {
            setLoadingRotation(false);
          }
        }, (error) => {
          console.error("Plays Snapshot Error:", error);
          setLoadingRotation(false);
        });

        // B. Friends Reviews (Real-time)
        const following = (profile as any)?.following || [];
        if (following.length > 0) {
          const qFriends = query(
            collection(db, 'activities'),
            where('type', '==', 'review_added'),
            where('userId', 'in', following.slice(0, 10)),
            orderBy('timestamp', 'desc'),
            limit(3)
          );
          
          unsubscribeFriends = onSnapshot(qFriends, (snap) => {
            setFriendReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoadingReviews(false);
          }, (error) => {
            console.error("Friends Reviews Snapshot Error:", error);
            setLoadingReviews(false);
          });
        } else {
          setFriendReviews([]);
          setLoadingReviews(false);
        }
      } else {
        setLoadingRotation(false);
        setLoadingReviews(false);
      }
    };

    initDashboard();

    return () => {
      if (unsubscribeRecent) unsubscribeRecent();
      if (unsubscribePlays) unsubscribePlays();
      if (unsubscribeFriends) unsubscribeFriends();
      unsubscribeRotation.forEach(u => u());
    };
  }, [user, profile]);

  useEffect(() => {
    if (rotationGames.length > 0 && rotationIndex >= rotationGames.length) {
      setRotationIndex(rotationGames.length - 1);
    }
  }, [rotationGames]);

  // Removed global loading check to allow shell to render instantly

  return (
    <div className="min-h-screen bg-charcoal pt-12 pb-32 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* App Header / Logo */}
        <header className="flex flex-col items-center justify-center py-8">
          <div className="flex items-center gap-3 group">
            <div className="p-3 bg-gold-accent/10 rounded-2xl border border-gold-accent/20 shadow-lg shadow-gold-accent/5 group-hover:scale-110 transition-transform duration-500">
              <Dices className="w-8 h-8 text-gold-accent" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-accent to-gold-accent drop-shadow-sm">
              CritShelf
            </h1>
          </div>
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mt-2 ml-12">
            Your Tabletop Legacy
          </p>
        </header>

        {/* Step 1: The "Heavy Rotation" Section */}
        <section>
          <div className="flex items-center justify-between mb-6 px-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-accent/10 rounded-lg flex items-center justify-center border border-emerald-accent/20">
                <ActivityIcon className="w-4 h-4 text-emerald-accent" />
              </div>
              <h2 className="text-xl font-black text-white tracking-tight uppercase tracking-widest text-[10px]">Your Heavy Rotation</h2>
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
                <h3 className="text-xl font-black text-white mb-2">Track Your Rotation</h3>
                <p className="text-white/40 font-medium mb-8 max-w-sm mx-auto">
                  Sign up to track your rolling play history and identify your table's heavy favorites.
                </p>
                <button 
                  onClick={() => navigate('/auth')}
                  className="bg-emerald-accent text-charcoal px-8 py-3 rounded-2xl font-black text-sm shadow-lg hover:shadow-emerald-accent/20 transition-all hover:scale-105"
                >
                  Get Started
                </button>
              </div>
            ) : loadingRotation ? (
              <div className="relative">
                <GameCardSkeleton />
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-white/5" />
                  ))}
                </div>
              </div>
            ) : rotationGames.length > 0 ? (
              <div className="relative group">
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={rotationGames[rotationIndex].id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="relative"
                  >
                    <GameCard 
                      game={rotationGames[rotationIndex]} 
                      personalRating={profile?.ratings?.[rotationGames[rotationIndex].id]}
                      groupRating={groupRatings[rotationGames[rotationIndex].id]?.rating}
                      groupName={groupRatings[rotationGames[rotationIndex].id]?.groupName}
                    />
                    
                    {/* Play Count Badge - High Visibility Emerald */}
                    <div className="absolute top-4 right-4 bg-emerald-accent/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-2xl z-20 border border-emerald-accent/30 pointer-events-none transition-transform">
                      <div className="flex flex-col items-center">
                        <span className="text-[14px] font-black text-white leading-none">
                          {rotationGames[rotationIndex].playCount}
                        </span>
                        <span className="text-[8px] font-black text-white/80 uppercase tracking-widest">
                          {rotationGames[rotationIndex].playCount === 1 ? 'Play' : 'Plays'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Carousel Paging Arrows */}
                {rotationIndex > 0 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setRotationIndex(prev => prev - 1);
                    }}
                    className="absolute -left-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-charcoal/80 backdrop-blur-md rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-emerald-accent hover:text-charcoal transition-all shadow-2xl active:scale-95 group/btn"
                  >
                    <ChevronLeft className="w-6 h-6 group-hover/btn:-translate-x-1 transition-transform" />
                  </button>
                )}

                {rotationIndex < rotationGames.length - 1 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setRotationIndex(prev => prev + 1);
                    }}
                    className="absolute -right-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-charcoal/80 backdrop-blur-md rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-emerald-accent hover:text-charcoal transition-all shadow-2xl active:scale-95 group/btn"
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
                        "w-2 h-2 rounded-full transition-all duration-300",
                        idx === rotationIndex ? "bg-emerald-accent w-6" : "bg-white/10"
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
                <h3 className="text-xl font-black text-white mb-2">No Plays Yet</h3>
                <p className="text-white/30 font-bold">Log Plays to Start your Rotation</p>
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
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest text-center">Record Play</span>
            </button>

            <button 
              onClick={() => navigate('/browse')}
              className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex flex-col items-center gap-3 hover:bg-white/10 transition-all group"
            >
              <div className="w-12 h-12 bg-emerald-accent/10 rounded-2xl flex items-center justify-center border border-emerald-accent/20 group-hover:scale-110 transition-transform">
                <Search className="w-6 h-6 text-emerald-accent" />
              </div>
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest text-center">Find Game</span>
            </button>

            <button 
              onClick={() => navigate('/social')}
              className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex flex-col items-center gap-3 hover:bg-white/10 transition-all group"
            >
              <div className="w-12 h-12 bg-emerald-accent/10 rounded-2xl flex items-center justify-center border border-emerald-accent/20 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-emerald-accent" />
              </div>
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest text-center">Social Hub</span>
            </button>
          </section>
        )}

        {/* Newdiscovery Section: Recently Added to CritShelf */}
        <section className="py-4">
          <div className="flex items-center gap-3 mb-6 px-2">
            <div className="w-8 h-8 bg-gold-accent/10 rounded-lg flex items-center justify-center border border-gold-accent/20">
              <Plus className="w-4 h-4 text-gold-accent" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight uppercase tracking-widest text-[10px]">Recently Added to CritShelf</h2>
          </div>

          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-6 px-2 items-stretch">
            {loadingRecent ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="w-full shrink-0 snap-center min-h-[12rem]">
                  <GameCardSkeleton className="h-full" />
                </div>
              ))
            ) : recentGames.length > 0 ? (
              recentGames.map((game) => (
                <div key={game.id} className="w-full shrink-0 snap-center">
                  <GameCard 
                    game={game} 
                    compact 
                    personalRating={profile?.ratings?.[game.id]}
                    groupRating={groupRatings[game.id]?.rating}
                    groupName={groupRatings[game.id]?.groupName}
                  />
                </div>
              ))
            ) : (
              <div className="w-full text-center py-12 bg-white/5 rounded-[2.5rem] border border-dashed border-white/10">
                <p className="text-white/20 font-bold text-sm uppercase tracking-widest">No Discovery Feed Available</p>
              </div>
            )}
          </div>
        </section>

        {/* Step 3: Recent Ratings Feed */}
        <section>
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gold-accent/10 rounded-lg flex items-center justify-center border border-gold-accent/20">
                <Star className="w-4 h-4 text-gold-accent fill-gold-accent" />
              </div>
              <h2 className="text-xl font-black text-white tracking-tight uppercase tracking-widest text-[10px]">Recent Ratings</h2>
            </div>
          </div>

          <div className="space-y-6 mb-8">
            {!user ? (
               <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center">
                <MessageCircle className="w-10 h-10 text-emerald-accent/20 mx-auto mb-3" />
                <h3 className="text-lg font-black text-white mb-2">Join the Community</h3>
                <p className="text-white/40 text-sm font-medium mb-6">See what your friends are playing and reviewing.</p>
                <button 
                  onClick={() => navigate('/auth')}
                  className="w-full py-3 rounded-xl border border-emerald-accent/20 text-emerald-accent font-black text-[10px] uppercase tracking-widest hover:bg-emerald-accent hover:text-charcoal transition-all"
                >
                  Login to see reviews
                </button>
              </div>
            ) : loadingReviews ? (
              [1, 2, 3].map(i => (
                <div key={i} className="animate-pulse bg-white/5 border border-white/10 rounded-[2.5rem] p-6 h-32 shadow-xl" />
              ))
            ) : friendReviews.length > 0 ? (
              friendReviews.map((activity) => (
                <motion.div 
                  key={activity.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 shadow-xl relative group hover:bg-white/[0.07] transition-all"
                >
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Character/Friend Column */}
                    <div className="flex flex-row md:flex-col items-center gap-4 shrink-0">
                      <UserAvatar 
                         user={{ uid: activity.userId, avatarSeed: activity.avatarSeed }} 
                         size="md" 
                         className="rounded-2xl border-2 border-white/10 shadow-lg group-hover:border-gold-accent/30 transition-all" 
                      />
                      <div className="text-left md:text-center">
                        <span className="text-sm font-black text-white block truncate max-w-[100px]">{activity.userName}</span>
                        <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Friend</span>
                      </div>
                    </div>

                    {/* Content Column */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-16 rounded-xl overflow-hidden border border-white/10 shadow-lg flex-shrink-0">
                            <img 
                              src={activity.metadata.gameCover} 
                              alt={activity.metadata.gameTitle}
                              className="w-full h-full object-cover transition-transform group-hover:scale-110"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-white leading-tight uppercase tracking-tight line-clamp-1">
                              {activity.metadata.gameTitle}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                               <MessageCircle className="w-3 h-3 text-gold-accent/50" />
                               <span className="text-[9px] font-black text-white/20 uppercase tracking-tighter">Review Posted</span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <D20Die 
                            value={activity.metadata.score} 
                            theme="gold" 
                            size="sm" 
                            className="drop-shadow-[0_0_10px_rgba(251,191,36,0.2)]" 
                          />
                        </div>
                      </div>

                      {activity.metadata.text ? (
                        <div className="relative">
                          <Quote className="absolute -top-1 -left-2 w-4 h-4 text-white/5" />
                          <p className="text-white/60 text-sm italic leading-relaxed line-clamp-2 pl-4">
                            "{activity.metadata.text}"
                          </p>
                        </div>
                      ) : (
                        <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest mt-2 ml-4">
                          Rated without a comment
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-16 bg-white/5 rounded-[3rem] border-2 border-dashed border-white/10">
                <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <h3 className="text-lg font-black text-white mb-2">No Reviews from Friends</h3>
                <p className="text-white/30 text-sm font-bold max-w-xs mx-auto">
                  Follow some fellow gamers or get your friends to share their thoughts!
                </p>
                <button 
                  onClick={() => navigate('/search-users')}
                  className="mt-6 text-gold-accent font-black text-[10px] uppercase tracking-widest hover:underline"
                >
                  Discover new friends
                </button>
              </div>
            )}
          </div>

          <button 
            onClick={() => navigate('/friend-reviews')}
            className="w-full py-4 rounded-2xl border-2 border-white/10 text-white/40 font-black text-xs uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all flex items-center justify-center gap-2 group"
          >
            See All Friend Reviews
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
