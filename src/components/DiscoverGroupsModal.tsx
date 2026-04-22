import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Plus, Users, Loader2, ChevronRight, Compass, Ticket, ArrowRight, ShieldCheck, X as XIcon } from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, getDocs, limit, orderBy, addDoc, serverTimestamp, updateDoc, doc, arrayUnion, getDoc } from 'firebase/firestore';
import { useUser } from '../contexts/UserContext';
import { cn } from '../lib/utils';
import GroupAvatar from './GroupAvatar';
import CreateGroupModal from './CreateGroupModal';
import { logActivity } from '../lib/activityLogger';

interface DiscoverGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToGroup: (groupId: string) => void;
}

interface GroupResult {
  id: string;
  name: string;
  description: string;
  avatarSeed?: string;
  memberCount: number;
  memberIds: string[];
}

const DiscoverGroupsModal: React.FC<DiscoverGroupsModalProps> = ({ isOpen, onClose, onNavigateToGroup }) => {
  const { user, profile } = useUser();
  const [activeView, setActiveView] = useState<'hub' | 'search'>('hub');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GroupResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [joinCode, setJoinCode] = useState('');
  const [isJoiningWithCode, setIsJoiningWithCode] = useState(false);
  const [joinCodeError, setJoinCodeError] = useState('');

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // Basic search (prefix match if possible, or just list with filtering)
      const q = query(
        collection(db, 'groups'),
        where('isPrivate', '==', false),
        orderBy('name'),
        limit(50)
      );
      
      const snapshot = await getDocs(q);
      const results = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            description: data.description,
            avatarSeed: data.avatarSeed,
            memberCount: (data.memberIds || data.members || []).length,
            memberIds: data.memberIds || []
          };
        })
        .filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      setSearchResults(results);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'groups_search');
    } finally {
      setIsSearching(false);
    }
  };

  const handleRequestToJoin = async (group: GroupResult) => {
    if (!user) return;
    
    try {
      const requestRef = collection(db, 'groups', group.id, 'JoinRequests');
      await addDoc(requestRef, {
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        status: 'pending',
        requestedAt: serverTimestamp()
      });
      
      setRequestedIds(prev => new Set(prev).add(group.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `groups/${group.id}/JoinRequests`);
    }
  };

  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinCode.trim() || joinCode.length !== 6) return;

    setIsJoiningWithCode(true);
    setJoinCodeError('');
    try {
      const q = query(
        collection(db, 'groups'),
        where('joinCode', '==', joinCode.trim().toUpperCase())
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setJoinCodeError('Invalid invite code');
        return;
      }

      const groupDoc = snapshot.docs[0];
      const groupData = groupDoc.data();
      const memberIds = groupData.memberIds || [];

      if (memberIds.includes(user.uid)) {
        onNavigateToGroup(groupDoc.id);
        onClose();
        return;
      }

      // Direct join
      await updateDoc(doc(db, 'groups', groupDoc.id), {
        members: arrayUnion({ userId: user.uid, role: 'member' }),
        memberIds: arrayUnion(user.uid)
      });

      // Log Activity
      logActivity({
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        avatarSeed: (profile as any)?.avatarSeed || user.uid,
        type: 'new_member',
        groupId: groupDoc.id,
        groupName: groupData.name
      });

      onNavigateToGroup(groupDoc.id);
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'groups_join_code');
    } finally {
      setIsJoiningWithCode(false);
    }
  };

  useEffect(() => {
    if (searchQuery.length > 2) {
      const timer = setTimeout(() => handleSearch(), 500);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-charcoal rounded-[3rem] shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gold-accent/10 rounded-2xl flex items-center justify-center border border-gold-accent/20">
                    <Compass className="w-6 h-6 text-gold-accent" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white leading-tight">Discover Groups</h2>
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-1">Find your next gaming circle</p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-3 text-white/20 hover:text-white transition-colors hover:bg-white/5 rounded-2xl"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-12 no-scrollbar">
                {/* Search Section */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 bg-purple-500 rounded-full" />
                      <h3 className="text-xs font-black text-white/40 uppercase tracking-widest">Public Search</h3>
                    </div>
                    <button 
                      onClick={() => setIsCreateModalOpen(true)}
                      className="flex items-center gap-2 text-[10px] font-black text-purple-500 uppercase tracking-widest hover:text-white transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Create New Group
                    </button>
                  </div>
                  
                  <div className="relative group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-500 transition-colors" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by group name..."
                      className="w-full bg-white/5 border-2 border-white/10 rounded-[2rem] pl-16 pr-6 py-5 text-white placeholder:text-white/10 focus:outline-none focus:border-purple-500/50 transition-all font-bold"
                    />
                  </div>

                  <div className="space-y-3">
                    {isSearching ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-gold-accent" />
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map(group => {
                        const isMember = user && group.memberIds.includes(user.uid);
                        const isRequested = requestedIds.has(group.id);

                        return (
                          <div
                            key={group.id}
                            className="w-full flex items-center gap-5 p-5 bg-white/5 border border-white/10 rounded-2xl transition-all group"
                          >
                            <div 
                              className="cursor-pointer"
                              onClick={() => onNavigateToGroup(group.id)}
                            >
                              <GroupAvatar seed={group.avatarSeed} size="md" className="rounded-xl" />
                            </div>
                            
                            <div 
                              className="flex-1 cursor-pointer"
                              onClick={() => onNavigateToGroup(group.id)}
                            >
                              <h4 className="font-black text-white group-hover:text-gold-accent transition-colors uppercase tracking-tight">{group.name}</h4>
                              <p className="text-xs font-bold text-white/30 line-clamp-1">{group.description}</p>
                              <div className="flex items-center gap-1.5 text-white/20 font-black text-[10px] uppercase tracking-widest mt-1">
                                <Users className="w-3 h-3" /> {group.memberCount} Members
                              </div>
                            </div>

                            <div className="shrink-0">
                              {isMember ? (
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-accent bg-emerald-accent/10 px-3 py-2 rounded-xl border border-emerald-accent/20">
                                  Already a Member
                                </span>
                              ) : (
                                <button
                                  disabled={isRequested}
                                  onClick={() => handleRequestToJoin(group)}
                                  className={cn(
                                    "px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                                    isRequested
                                      ? "bg-white/5 text-white/20 border border-white/10"
                                      : "bg-gold-accent text-charcoal shadow-lg hover:scale-105 active:scale-95"
                                  )}
                                >
                                  {isRequested ? 'Requested' : 'Request to Join'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : searchQuery.length > 2 ? (
                      <div className="text-center py-12 bg-white/5 rounded-3xl border-2 border-dashed border-white/10">
                        <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
                        <h4 className="text-white/40 font-black uppercase tracking-widest text-sm">No groups found</h4>
                        <p className="text-white/10 text-xs font-bold mt-2">Try a different search term or check an invite code below!</p>
                      </div>
                    ) : null}
                  </div>
                </section>

                {/* Join Code Section */}
                <section className="space-y-6 pt-12 border-t border-white/5">
                  <div className="flex items-center gap-2 px-4">
                    <Ticket className="w-4 h-4 text-gold-accent" />
                    <h3 className="text-xs font-black text-white/40 uppercase tracking-widest">Join with Invite Code</h3>
                  </div>
                  
                  <div className="bg-gradient-to-br from-gold-accent/5 to-transparent border border-gold-accent/10 rounded-[2.5rem] p-8">
                    <p className="text-sm font-bold text-white/30 mb-6 leading-relaxed">
                      If you have a 6-digit invite code from a group leader, enter it below to join instantly.
                    </p>
                    <form onSubmit={handleJoinWithCode} className="relative group">
                      <input
                        type="text"
                        value={joinCode}
                        onChange={(e) => {
                          setJoinCode(e.target.value.toUpperCase());
                          if (joinCodeError) setJoinCodeError('');
                        }}
                        maxLength={6}
                        placeholder="ENTER 6-DIGIT CODE"
                        className={cn(
                          "w-full bg-charcoal border-2 rounded-2xl px-6 py-6 text-white placeholder:text-white/10 outline-none transition-all font-mono text-2xl tracking-[0.4em] font-black text-center",
                          joinCodeError ? "border-rose-500/50" : "border-white/10 focus:border-gold-accent shadow-inner"
                        )}
                      />
                      <button
                        type="submit"
                        disabled={joinCode.length !== 6 || isJoiningWithCode}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-4 bg-gold-accent text-charcoal rounded-xl shadow-xl disabled:opacity-30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 group/btn"
                      >
                        {isJoiningWithCode ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Join Group</span>
                            <ArrowRight className="w-6 h-6 group-hover/btn:translate-x-1 transition-transform" />
                          </>
                        )}
                      </button>
                    </form>
                    {joinCodeError && (
                      <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest mt-4 ml-4 flex items-center gap-2">
                        <XIcon className="w-3 h-3" /> {joinCodeError}
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CreateGroupModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(id) => {
          setIsCreateModalOpen(false);
          onNavigateToGroup(id);
        }}
      />
    </>
  );
};

export default DiscoverGroupsModal;
