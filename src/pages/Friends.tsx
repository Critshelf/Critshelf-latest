import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, Check, Users, History, ChevronRight, UserSearch as UserSearchIcon } from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import ACBadge from '../components/ACBadge';
import { useUser } from '../contexts/UserContext';
import UserAvatar from '../components/UserAvatar';

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  avatarPreference?: 'google' | 'dicebear';
  avatarSeed?: string;
  email: string;
  attackClass?: number;
}

export default function Friends() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchFriends(user.uid);
    }
  }, [user]);

  const fetchFriends = async (userId: string) => {
    const path = 'friendships';
    try {
      const q = query(collection(db, path), where('userIds', 'array-contains', userId));
      const snapshot = await getDocs(q);
      const friendIds = snapshot.docs.map(doc => {
        const data = doc.data();
        return data.userIds.find((id: string) => id !== userId);
      });

      const friendProfiles = await Promise.all(
        friendIds.map(async (id) => {
          const userDoc = await getDoc(doc(db, 'users', id));
          return { uid: id, ...userDoc.data() } as UserProfile;
        })
      );
      setFriends(friendProfiles);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal pb-32 md:pt-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-16 h-16 bg-emerald-accent rounded-[2rem] flex items-center justify-center shadow-xl">
            <Users className="w-8 h-8 text-charcoal" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight">Friends</h1>
            <p className="text-white/40 font-bold">Connect with your tabletop crew</p>
          </div>
        </div>

        {/* Search Section Link */}
        <div className="bg-white/5 rounded-[2.5rem] p-8 shadow-2xl border border-white/10 mb-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-emerald-accent/10 rounded-2xl flex items-center justify-center border border-emerald-accent/20">
              <UserSearchIcon className="w-8 h-8 text-emerald-accent" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Expand Your Crew</h2>
              <p className="text-white/40 font-medium">Search for friends and follow their activity</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/search-users')}
            className="w-full sm:w-auto bg-emerald-accent text-charcoal px-10 py-5 rounded-2xl font-black shadow-lg hover:shadow-emerald-accent/20 transition-all flex items-center justify-center gap-3 active:scale-95"
          >
            <Search className="w-5 h-5" />
            Find Friends
          </button>
        </div>

        {/* Friends List */}
        <div className="bg-white/5 rounded-[2.5rem] p-8 shadow-2xl border border-white/10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black text-white">My Crew ({friends.length})</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {friends.map((friend) => (
              <div key={friend.uid} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 group hover:border-emerald-accent/50 transition-all">
                <div className="flex items-center gap-4">
                  <UserAvatar user={friend} size="md" className="rounded-xl border border-white/10" />
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-black text-white">{friend.displayName}</p>
                      <ACBadge value={friend.attackClass} size="sm" />
                    </div>
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Friend</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/10 group-hover:text-emerald-accent transition-colors" />
              </div>
            ))}
            {friends.length === 0 && (
              <div className="col-span-full text-center py-12">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                  <Users className="w-8 h-8 text-white/10" />
                </div>
                <p className="text-white/20 font-bold">Your crew is empty! Use the search above to find friends.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
