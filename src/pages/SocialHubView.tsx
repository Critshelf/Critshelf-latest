import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Shield, 
  Activity as ActivityIcon, 
  Search, 
  Plus, 
  MessageCircle, 
  Star, 
  Clock,
  ChevronRight,
  UserMinus,
  Loader2,
  Trophy,
  Swords
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  doc, 
  getDoc, 
  updateDoc, 
  arrayRemove,
  startAfter,
  QueryDocumentSnapshot,
  documentId,
  onSnapshot
} from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import ACBadge from '../components/ACBadge';
import GroupAvatar from '../components/GroupAvatar';
import UserAvatar from '../components/UserAvatar';
import DiscoverGroupsModal from '../components/DiscoverGroupsModal';
import CreateGroupModal from '../components/CreateGroupModal';
import ActivityItem from '../components/ActivityItem';
import SocialHubFeed from '../components/SocialHubFeed';
import { useUser } from '../contexts/UserContext';

type Tab = 'activity' | 'friends' | 'groups';

interface FeedItem {
  id: string;
  type: 'review' | 'group_activity';
  sourceName: string;
  sourceAvatar?: string;
  title: string;
  subtitle?: string;
  score?: number;
  text?: string;
  createdAt: any;
  gameCover?: string;
  groupId?: string;
  userId?: string;
}

export default function SocialHubView() {
  const { user, profile, refreshProfile } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'activity';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [isDiscoverModalOpen, setIsDiscoverModalOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribeFriends: (() => void) | undefined;
    let unsubscribeGroups: (() => void) | undefined;

    if (!user || !profile) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const following = profile.following || [];
    setFollowingIds(following);

    if (following.length > 0) {
      const qFriends = query(collection(db, 'users'), where('uid', 'in', following.slice(0, 30)));
      unsubscribeFriends = onSnapshot(qFriends, (snap) => {
        const friendProfiles = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        setFriends(friendProfiles);
      }, (error) => {
        console.error("Error fetching friends:", error);
      });
    } else {
      setFriends([]);
    }

    const qGroups = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', user.uid)
    );
    unsubscribeGroups = onSnapshot(qGroups, (snap) => {
      const groupsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setGroups(groupsList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching groups:", error);
      setLoading(false);
    });

    return () => {
      if (unsubscribeFriends) unsubscribeFriends();
      if (unsubscribeGroups) unsubscribeGroups();
    };
  }, [user?.uid, profile?.following?.length]);

  useEffect(() => {
    const tab = searchParams.get('tab') as Tab;
    if (tab && ['activity', 'friends', 'groups'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleUnfollow = async (targetUid: string) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        following: arrayRemove(targetUid)
      });
      setFollowingIds(prev => prev.filter(id => id !== targetUid));
      setFriends(prev => prev.filter(f => f.uid !== targetUid));
      await refreshProfile();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center p-6 pt-32">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-[3rem] p-10 text-center space-y-8">
          <div className="w-20 h-20 bg-emerald-accent/10 rounded-3xl flex items-center justify-center mx-auto border border-emerald-accent/20">
            <Users className="w-10 h-10 text-emerald-accent" />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-white">Join the Community</h2>
            <p className="text-white/40 font-medium leading-relaxed">
              Log in to see what your friends are playing, join gaming groups, and stay updated with the CritShelf social feed.
            </p>
          </div>
          <button 
            onClick={() => navigate('/auth')}
            className="w-full bg-emerald-accent text-charcoal py-4 rounded-2xl font-black text-sm shadow-xl hover:shadow-emerald-accent/20 transition-all active:scale-95"
          >
            Sign In to Social Hub
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal pt-24 pb-32 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Tab Navigation */}
        <div className="flex items-center gap-8 border-b border-white/10 mb-10 overflow-x-auto no-scrollbar">
          {(['activity', 'friends', 'groups'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={cn(
                "pb-4 text-sm font-black uppercase tracking-widest transition-all relative whitespace-nowrap",
                activeTab === tab ? "text-emerald-accent" : "text-white/30 hover:text-white/60"
              )}
            >
              <div className="flex items-center gap-2">
                {tab === 'activity' && <ActivityIcon className="w-4 h-4" />}
                {tab === 'friends' && <Users className="w-4 h-4" />}
                {tab === 'groups' && <Shield className="w-4 h-4" />}
                {tab}
              </div>
              {activeTab === tab && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-accent rounded-full"
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'activity' && (
            <motion.div
              key="activity"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <SocialHubFeed />
            </motion.div>
          )}

          {activeTab === 'friends' && (
            <motion.div
              key="friends"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-white">Following ({friends.length})</h2>
                <button 
                  onClick={() => navigate('/search-users')}
                  className="bg-emerald-accent text-charcoal px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg hover:shadow-emerald-accent/20 transition-all active:scale-95"
                >
                  <Search className="w-4 h-4" />
                  Find Friends
                </button>
              </div>

              <div className="space-y-4">
                {friends.map((friend) => (
                  <Link to={`/profile/${friend.uid}`} key={friend.uid} className="bg-white/5 border border-white/10 rounded-[2rem] p-5 flex items-center gap-5 group hover:bg-white/10 transition-colors">
                    <UserAvatar 
                      user={friend} 
                      size="md" 
                      className="rounded-xl border border-white/10 group-hover:ring-2 group-hover:ring-emerald-accent transition-all" 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-lg font-black text-white group-hover:text-emerald-accent transition-colors truncate">{friend.displayName}</h3>
                        <ACBadge value={friend.attackClass} size="sm" />
                      </div>
                      <p className="text-white/40 text-xs font-bold uppercase tracking-widest">{friend.title || 'Gamer'}</p>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        handleUnfollow(friend.uid);
                      }}
                      className="p-3 rounded-xl bg-white/5 text-white/20 hover:bg-rose-500/20 hover:text-rose-500 transition-all border border-white/10"
                    >
                      <UserMinus className="w-5 h-5" />
                    </button>
                  </Link>
                ))}
                {friends.length === 0 && (
                  <div className="text-center py-20 bg-white/5 rounded-[3rem] border border-dashed border-white/10">
                    <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-white mb-2">Your crew is empty</h3>
                    <p className="text-white/40 font-medium">Start following other gamers to build your feed</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'groups' && (
            <motion.div
              key="groups"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-white">Your Groups ({groups.length})</h2>
                <button 
                  onClick={() => setIsDiscoverModalOpen(true)}
                  className="bg-purple-500 text-white px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg hover:shadow-purple-500/20 transition-all active:scale-95"
                >
                  <Users className="w-4 h-4" />
                  Discover Groups
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => navigate(`/groups/${group.id}`)}
                    className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 flex items-center gap-5 group hover:bg-white/[0.07] transition-all text-left"
                  >
                    <GroupAvatar seed={group.avatarSeed} size="md" className="bg-purple-500/10 border-purple-500/20 text-purple-500" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-black text-white truncate group-hover:text-purple-500 transition-colors">{group.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Users className="w-3 h-3 text-white/20" />
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">{(group.members || []).length} Members</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/10 group-hover:text-purple-500 transition-colors" />
                  </button>
                ))}
                {groups.length === 0 && (
                  <div className="col-span-full text-center py-20 bg-white/5 rounded-[3rem] border border-dashed border-white/10">
                    <Shield className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-white mb-2">No groups joined</h3>
                    <p className="text-white/40 font-medium">Join a gaming group to coordinate game nights</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <DiscoverGroupsModal 
        isOpen={isDiscoverModalOpen}
        onClose={() => setIsDiscoverModalOpen(false)}
        onNavigateToGroup={(groupId) => {
          setIsDiscoverModalOpen(false);
          navigate(`/groups/${groupId}`);
        }}
      />

      <CreateGroupModal 
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onSuccess={(groupId) => {
          setIsCreateGroupOpen(false);
          navigate(`/groups/${groupId}`);
        }}
      />
    </div>
  );
}
