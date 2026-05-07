import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  UserPlus, 
  UserCheck, 
  UserMinus,
  Loader2,
  Users,
  ChevronRight,
  SearchX
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  limit,
  orderBy,
  startAt,
  endAt
} from 'firebase/firestore';
import { useUser } from '../contexts/UserContext';
import UserAvatar from '../components/UserAvatar';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import ACBadge from '../components/ACBadge';
import { sendNotification } from '../services/notificationService';

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  avatarPreference?: 'google' | 'dicebear';
  avatarSeed?: string;
  bio?: string;
  attackClass?: number;
}

export default function UserSearchView() {
  const { user, profile, refreshProfile } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const navigate = useNavigate();

  // Sync following list from profile context
  useEffect(() => {
    if (profile) {
      setFollowing(profile.following || []);
    }
  }, [profile]);

  // Search logic
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const q = query(
          collection(db, 'users'),
          orderBy('displayName'),
          startAt(searchQuery),
          endAt(searchQuery + '\uf8ff'),
          limit(20)
        );

        const querySnapshot = await getDocs(q);
        const users: UserProfile[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as UserProfile;
          // Filter out current user
          if (data.uid !== user?.uid) {
            users.push(data);
          }
        });
        setResults(users);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, user]);

  const toggleFollow = async (targetUid: string) => {
    if (!user) return;

    const isFollowing = following.includes(targetUid);
    setActionLoading(targetUid);

    try {
      const userRef = doc(db, 'users', user.uid);
      if (isFollowing) {
        await updateDoc(userRef, {
          following: arrayRemove(targetUid)
        });
        setFollowing(prev => prev.filter(id => id !== targetUid));
      } else {
        await updateDoc(userRef, {
          following: arrayUnion(targetUid)
        });
        setFollowing(prev => [...prev, targetUid]);

        // Notify target user
        await sendNotification(
          targetUid,
          'social',
          'New Follower! 👋',
          `${profile?.displayName || 'Someone'} just started following you.`,
          { 
            targetId: user.uid,
            actionUrl: `/profile` // fallback to profile
          }
        );
      }
      await refreshProfile();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-black text-white tracking-tight mb-2 flex items-center gap-3">
            <Users className="w-10 h-10 text-emerald-accent" />
            Find Friends
          </h1>
          <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Build your CritShelf social graph</p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-12 group">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <Search className="w-6 h-6 text-white/20 group-focus-within:text-emerald-accent transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search by display name..."
            className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-6 pl-16 pr-6 text-xl font-bold text-white placeholder:text-white/10 outline-none focus:border-emerald-accent focus:bg-white/[0.07] transition-all shadow-2xl"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {loading && (
            <div className="absolute inset-y-0 right-6 flex items-center">
              <Loader2 className="w-6 h-6 text-emerald-accent animate-spin" />
            </div>
          )}
        </div>

        {/* Results */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {results.map((user) => (
              <motion.div
                key={user.uid}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 flex items-center gap-6 hover:bg-white/[0.07] transition-all group"
              >
                <div className="relative shrink-0">
                  <UserAvatar 
                    user={user} 
                    size="md" 
                    className="w-16 h-16 rounded-2xl border border-white/10" 
                  />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-accent rounded-lg flex items-center justify-center border-2 border-charcoal">
                    <Users className="w-3 h-3 text-charcoal" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-white truncate group-hover:text-emerald-accent transition-colors">
                      {user.displayName}
                    </h3>
                    <ACBadge value={user.attackClass} size="sm" />
                  </div>
                  <p className="text-white/40 text-sm font-medium line-clamp-1 italic">
                    {user.bio || "No bio yet..."}
                  </p>
                </div>

                <button
                  onClick={() => toggleFollow(user.uid)}
                  disabled={actionLoading === user.uid}
                  className={cn(
                    "px-6 py-3 rounded-xl font-black text-sm transition-all flex items-center gap-2 shrink-0 active:scale-95 disabled:opacity-50",
                    following.includes(user.uid)
                      ? "bg-white/10 text-white hover:bg-rose-500/20 hover:text-rose-500 hover:border-rose-500/50 border border-white/10"
                      : "border-2 border-emerald-accent text-emerald-accent hover:bg-emerald-accent hover:text-charcoal"
                  )}
                >
                  {actionLoading === user.uid ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : following.includes(user.uid) ? (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span className="group-hover:hidden">Following</span>
                      <span className="hidden group-hover:inline">Unfollow</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Follow
                    </>
                  )}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Empty State */}
          {!loading && searchQuery && results.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/10">
                <SearchX className="w-10 h-10 text-white/20" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">No gamers found</h3>
              <p className="text-white/40 font-medium">Try searching for a different name</p>
            </motion.div>
          )}

          {/* Initial State */}
          {!searchQuery && (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-emerald-accent/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-emerald-accent/20">
                <Users className="w-10 h-10 text-emerald-accent" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">Find your crew</h3>
              <p className="text-white/40 font-medium">Search for friends to see their ratings and activity</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
