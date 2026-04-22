import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity as ActivityIcon, 
  ChevronLeft, 
  Loader2, 
  Filter,
  Search,
  MessageSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  startAfter, 
  QueryDocumentSnapshot,
  where
} from 'firebase/firestore';
import ActivityItem from '../components/ActivityItem';
import { ActivityType } from '../lib/activityLogger';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';

const ACTIVITY_LIMIT = 20;

export default function ActivityLog() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ActivityType | 'all'>('all');

  useEffect(() => {
    fetchActivities(true);
  }, [activeFilter]);

  const fetchActivities = async (isNew = false) => {
    if (isNew) setLoading(true);
    else setLoadingMore(true);

    try {
      const activitiesRef = collection(db, 'activities');
      let q = query(
        activitiesRef,
        orderBy('timestamp', 'desc'),
        limit(ACTIVITY_LIMIT)
      );

      if (activeFilter !== 'all') {
        q = query(
          activitiesRef,
          where('type', '==', activeFilter),
          orderBy('timestamp', 'desc'),
          limit(ACTIVITY_LIMIT)
        );
      }

      if (!isNew && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      const newActivities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (isNew) {
        setActivities(newActivities);
      } else {
        setActivities(prev => [...prev, ...newActivities]);
      }

      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === ACTIVITY_LIMIT);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'activities');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const filters: { label: string; value: ActivityType | 'all' }[] = [
    { label: 'All', value: 'all' },
    { label: 'Plays', value: 'play_logged' },
    { label: 'Games', value: 'game_added' },
    { label: 'Groups', value: 'group_created' },
    { label: 'Events', value: 'event_created' },
    { label: 'Polls', value: 'poll_started' },
  ];

  return (
    <div className="min-h-screen bg-charcoal pt-24 pb-32">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-3 bg-white/5 rounded-2xl border border-white/10 text-white/40 hover:text-emerald-accent hover:border-emerald-accent/50 transition-all active:scale-95"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gold-accent/10 rounded-xl flex items-center justify-center border border-gold-accent/20">
                  <ActivityIcon className="w-6 h-6 text-gold-accent" />
                </div>
                <h1 className="text-4xl font-black text-white tracking-tight">Activity Log</h1>
              </div>
              <p className="text-white/40 font-bold uppercase tracking-widest text-[10px] mt-1 ml-13">The heartbeat of your community</p>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {filters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setActiveFilter(filter.value)}
                className={cn(
                  "px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap border",
                  activeFilter === filter.value
                    ? "bg-gold-accent text-charcoal border-gold-accent shadow-lg shadow-gold-accent/20"
                    : "bg-white/5 text-white/30 border-white/10 hover:border-white/20"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-24 bg-white/5 rounded-[2rem] border border-white/10 animate-pulse shadow-xl" />
              ))}
            </div>
          ) : activities.length > 0 ? (
            <>
              {activities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
              
              {hasMore && (
                <div className="flex justify-center pt-8">
                  <button
                    onClick={() => fetchActivities()}
                    disabled={loadingMore}
                    className="px-10 py-5 bg-white/5 border border-white/10 rounded-3xl text-white/40 font-black text-xs uppercase tracking-widest hover:bg-white/10 hover:text-emerald-accent hover:border-emerald-accent/30 transition-all disabled:opacity-50 flex items-center gap-3 shadow-xl hover:shadow-emerald-accent/5"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <ActivityIcon className="w-5 h-5" />
                        Load More Activity
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-32 bg-white/5 rounded-[3rem] border-2 border-dashed border-white/10 shadow-2xl">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/10">
                <MessageSquare className="w-10 h-10 text-white/10" />
              </div>
              <h3 className="text-3xl font-black text-white mb-3">Quiet on the front...</h3>
              <p className="text-white/30 font-bold max-w-sm mx-auto leading-relaxed">
                No activity records found matching your current filter. Start playing or join a group to see this fill up!
              </p>
              <button 
                onClick={() => setActiveFilter('all')}
                className="mt-8 text-emerald-accent font-black text-sm uppercase tracking-widest hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
