import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ChevronLeft, 
  Star, 
  MessageCircle, 
  Users, 
  Loader2,
  Quote,
  TrendingUp,
  Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  orderBy, 
  startAfter,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { useUser } from '../contexts/UserContext';
import UserAvatar from '../components/UserAvatar';
import D20Die from '../components/D20Die';
import { cn } from '../lib/utils';

const REVIEWS_LIMIT = 20;

export default function FriendReviews() {
  const { profile, user } = useUser();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchReviews();
  }, [profile]);

  const fetchReviews = async (isLoadMore = false) => {
    if (!profile) return;
    
    const following = (profile as any)?.following || [];
    if (following.length === 0) {
      setReviews([]);
      setLoading(false);
      setHasMore(false);
      return;
    }

    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      let q = query(
        collection(db, 'activities'),
        where('type', '==', 'review_added'),
        where('userId', 'in', following.slice(0, 10)),
        orderBy('timestamp', 'desc'),
        limit(REVIEWS_LIMIT)
      );

      if (isLoadMore && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snap = await getDocs(q);
      const newReviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (isLoadMore) {
        setReviews(prev => [...prev, ...newReviews]);
      } else {
        setReviews(newReviews);
      }

      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === REVIEWS_LIMIT);
    } catch (error) {
      console.error("Error fetching friend reviews:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal pb-32">
      {/* Header */}
      <div className="bg-white/5 border-b border-white/10 pt-16 pb-8 px-6 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-3 rounded-2xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all border border-white/10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Friend Reviews</h1>
              <p className="text-gold-accent text-xs font-black uppercase tracking-[0.2em] mt-1">Gamer Discovery Feed</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gold-accent/10 rounded-xl border border-gold-accent/20">
            <TrendingUp className="w-4 h-4 text-gold-accent" />
            <span className="text-[10px] font-black text-gold-accent uppercase tracking-widest">Global Pulse</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 mt-8">
        {/* Friend Review Stream */}
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse bg-white/5 border border-white/10 rounded-[2.5rem] p-8 h-48 shadow-2xl" />
            ))}
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-6">
            {reviews.map((activity, idx) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative group hover:bg-white/[0.07] transition-all"
              >
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Friend Info */}
                  <div className="flex flex-row md:flex-col items-center gap-4 shrink-0">
                    <UserAvatar 
                      user={{ uid: activity.userId, avatarSeed: activity.avatarSeed }} 
                      size="lg" 
                      className="rounded-3xl border-4 border-white/5 shadow-2xl group-hover:border-gold-accent/30 transition-all" 
                    />
                    <div className="text-left md:text-center">
                      <h3 className="text-lg font-black text-white group-hover:text-gold-accent transition-colors truncate max-w-[120px]">
                        {activity.userName}
                      </h3>
                      <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Fellow Gamer</span>
                    </div>
                  </div>

                  {/* Review Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-6">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-20 rounded-2xl overflow-hidden border border-white/10 shadow-2xl shrink-0">
                          <img 
                            src={activity.metadata.gameCover || undefined} 
                            alt={activity.metadata.gameTitle}
                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-white tracking-tight uppercase leading-none mb-2">
                             {activity.metadata.gameTitle}
                          </h2>
                          <div className="flex items-center gap-3">
                             <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                               <MessageCircle className="w-3 h-3 text-gold-accent" />
                               <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Verified Review</span>
                             </div>
                             <span className="text-[10px] text-white/10 font-black uppercase">Recent</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex sm:flex-col items-center gap-3">
                        <D20Die 
                          value={activity.metadata.score} 
                          theme="gold" 
                          size="md" 
                          className="drop-shadow-[0_0_20px_rgba(251,191,36,0.2)]" 
                        />
                        <span className="text-[10px] font-black text-gold-accent uppercase tracking-[0.2em] hidden sm:block">Rating</span>
                      </div>
                    </div>

                    <div className="bg-charcoal/40 border border-white/5 rounded-3xl p-6 relative">
                      <Quote className="absolute top-4 left-4 w-8 h-8 text-white/[0.02] -scale-x-100" />
                      {activity.metadata.text ? (
                        <p className="text-white/70 text-lg leading-relaxed italic relative z-10">
                          "{activity.metadata.text}"
                        </p>
                      ) : (
                        <p className="text-white/20 text-sm font-black uppercase tracking-widest text-center py-4">
                          No written review provided
                        </p>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => navigate(`/game/${activity.metadata.gameId}`)}
                      className="mt-6 text-[10px] font-black text-white/20 uppercase tracking-[0.3em] hover:text-emerald-accent transition-colors flex items-center gap-2 group/btn"
                    >
                      View Game Intel
                      <ChevronLeft className="w-4 h-4 rotate-180 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}

            {hasMore && (
              <div className="flex justify-center pt-8">
                <button
                  onClick={() => fetchReviews(true)}
                  disabled={loadingMore}
                  className="px-12 py-5 bg-white/5 border-2 border-white/10 rounded-[2.5rem] text-white/40 font-black text-sm uppercase tracking-[0.3em] hover:bg-gold-accent hover:text-charcoal hover:border-gold-accent transition-all disabled:opacity-50 flex items-center gap-4 shadow-2xl"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Manifesting...
                    </>
                  ) : (
                    <>
                      <Star className="w-5 h-5 text-gold-accent" />
                      Load More Reviews
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-32 bg-white/5 rounded-[4rem] border-2 border-dashed border-white/10 shadow-2xl">
            <div className="w-24 h-24 bg-gold-accent/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-gold-accent/20">
               <Filter className="w-10 h-10 text-gold-accent/30" />
            </div>
            <h2 className="text-3xl font-black text-white mb-4">Silence in the Hall</h2>
            <p className="text-white/30 font-bold max-w-sm mx-auto text-lg leading-relaxed">
              Your friends haven't left any reviews yet. Be the trendsetter and log your first rating!
            </p>
            <button 
              onClick={() => navigate('/')}
              className="mt-12 px-8 py-4 bg-gold-accent text-charcoal rounded-2xl font-black shadow-lg hover:scale-105 transition-transform"
            >
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
