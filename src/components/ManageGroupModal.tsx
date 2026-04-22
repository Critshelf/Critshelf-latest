import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Settings, 
  Users, 
  UserPlus, 
  Check, 
  X as XIcon, 
  Loader2, 
  Copy, 
  Crown,
  Trash2,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { useUser } from '../contexts/UserContext';
import { cn } from '../lib/utils';
import UserAvatar from './UserAvatar';

interface JoinRequest {
  id: string;
  userId: string;
  userDisplayName: string;
  userAvatar?: string;
  status: 'pending' | 'accepted' | 'declined';
  requestedAt: any;
}

interface Member {
  uid: string;
  displayName: string;
  photoURL: string;
  role: 'leader' | 'member';
}

interface ManageGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  joinCode: string;
  isPrivate: boolean;
  members: Member[];
  onRefresh: () => void;
}

const ManageGroupModal: React.FC<ManageGroupModalProps> = ({ 
  isOpen, 
  onClose, 
  groupId, 
  joinCode, 
  isPrivate,
  members,
  onRefresh 
}) => {
  const { user } = useUser();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !groupId) return;

    const q = query(
      collection(db, 'groups', groupId, 'JoinRequests'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as JoinRequest));
      setRequests(reqList);
      setLoadingRequests(false);
    });

    return () => unsubscribe();
  }, [isOpen, groupId]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePrivacy = async () => {
    setIsUpdatingPrivacy(true);
    try {
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        isPrivate: !isPrivate
      });
      onRefresh();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${groupId}/privacy`);
    } finally {
      setIsUpdatingPrivacy(false);
    }
  };

  const handleAction = async (requestId: string, action: 'accept' | 'deny', requestUserId?: string) => {
    setProcessingId(requestId);
    try {
      const requestRef = doc(db, 'groups', groupId, 'JoinRequests', requestId);
      
      if (action === 'accept' && requestUserId) {
        // Add to group members
        const groupRef = doc(db, 'groups', groupId);
        await updateDoc(groupRef, {
          members: arrayUnion({ userId: requestUserId, role: 'member' }),
          memberIds: arrayUnion(requestUserId)
        });
        
        await updateDoc(requestRef, { status: 'accepted' });
        onRefresh();
      } else {
        await updateDoc(requestRef, { status: 'declined' });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `JoinRequests/${requestId}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleTransferLeadership = async (targetUserId: string) => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to transfer leadership? You will become a regular member.")) return;

    setProcessingId(targetUserId);
    try {
      const groupRef = doc(db, 'groups', groupId);
      const groupSnap = await getDoc(groupRef);
      
      if (groupSnap.exists()) {
        const currentMembers = groupSnap.data().members as { userId: string; role: string }[];
        
        const updatedMembers = currentMembers.map(m => {
          if (m.userId === user.uid) return { ...m, role: 'member' };
          if (m.userId === targetUserId) return { ...m, role: 'leader' };
          return m;
        });

        await updateDoc(groupRef, { members: updatedMembers });
        onRefresh();
        onClose(); // Close as they are no longer leader
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${groupId}/transfer`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-3xl bg-charcoal rounded-[3rem] shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gold-accent/10 rounded-2xl flex items-center justify-center border border-gold-accent/20">
                  <Settings className="w-6 h-6 text-gold-accent" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">Manage Group</h2>
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-1">Leader Control Center</p>
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
              {/* Privacy & Invite Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-gold-accent rounded-full" />
                  <h3 className="text-xs font-black text-white/40 uppercase tracking-widest">Privacy & Invites</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-[2rem] p-8 border border-white/10 flex flex-col justify-between gap-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-lg font-black text-white leading-tight">Private Group</h4>
                        <button
                          disabled={isUpdatingPrivacy}
                          onClick={togglePrivacy}
                          className={cn(
                            "w-12 h-6 rounded-full relative transition-all duration-300",
                            isPrivate ? "bg-emerald-accent" : "bg-white/10"
                          )}
                        >
                          <motion.div
                            animate={{ x: isPrivate ? 24 : 4 }}
                            className={cn(
                              "absolute top-1 w-4 h-4 rounded-full shadow-lg",
                              isPrivate ? "bg-charcoal" : "bg-white/40"
                            )}
                          />
                        </button>
                      </div>
                      <p className="text-sm font-bold text-white/30">
                        {isPrivate 
                          ? "HIDDEN: This group won't appear in public search results." 
                          : "VISIBLE: Anyone can find this group and request to join."}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-[2rem] p-8 border border-white/10 flex flex-col justify-between gap-6">
                    <div>
                      <h4 className="text-lg font-black text-white mb-2 leading-tight">Invite Code</h4>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 px-4 py-3 bg-charcoal border border-white/10 rounded-xl font-mono text-lg font-black text-gold-accent tracking-widest text-center">
                          {joinCode}
                        </div>
                        <button 
                          onClick={handleCopyCode}
                          className={cn(
                            "p-3 rounded-xl transition-all active:scale-95 border",
                            copied 
                              ? "bg-emerald-accent border-emerald-accent text-charcoal" 
                              : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:border-white/20"
                          )}
                        >
                          {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Pending Requests */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-4 bg-emerald-accent rounded-full" />
                    <h3 className="text-xs font-black text-white/40 uppercase tracking-widest">Join Requests</h3>
                  </div>
                  <span className="bg-emerald-accent/10 text-emerald-accent px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {requests.length} Pending
                  </span>
                </div>

                <div className="space-y-3">
                  {loadingRequests ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-accent" />
                    </div>
                  ) : requests.length > 0 ? (
                    requests.map(req => (
                      <div 
                        key={req.id}
                        className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6"
                      >
                        <div className="flex items-center gap-4">
                          <UserAvatar 
                            user={{ uid: req.userId, displayName: req.userDisplayName, photoURL: req.userAvatar }} 
                            size="md" 
                            className="rounded-2xl border-2 border-white/5 shadow-xl"
                          />
                          <div>
                            <h4 className="font-black text-white text-lg">{req.userDisplayName}</h4>
                            <p className="text-xs font-bold text-white/20 uppercase tracking-widest">Wants to join</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <button
                            disabled={!!processingId}
                            onClick={() => handleAction(req.id, 'deny')}
                            className="flex-1 sm:flex-none px-6 py-3 rounded-xl border border-rose-500/30 text-rose-500 font-black text-xs uppercase tracking-widest hover:bg-rose-500/5 transition-all"
                          >
                            Deny
                          </button>
                          <button
                            disabled={!!processingId}
                            onClick={() => handleAction(req.id, 'accept', req.userId)}
                            className="flex-1 sm:flex-none px-6 py-3 bg-emerald-accent text-charcoal rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-accent/20 hover:scale-105 active:scale-95 transition-all"
                          >
                            {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Accept'}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 bg-white/5 rounded-3xl border-2 border-dashed border-white/5">
                      <UserPlus className="w-12 h-12 text-white/5 mx-auto mb-4" />
                      <p className="text-white/20 text-xs font-black uppercase tracking-widest text-[10px]">No pending requests</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Roster & Role Management */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-purple-500 rounded-full" />
                  <h3 className="text-xs font-black text-white/40 uppercase tracking-widest">Member Roster</h3>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] divide-y divide-white/5 overflow-hidden">
                  {members.map(member => (
                    <div key={member.uid} className="p-6 flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <UserAvatar user={member} size="sm" className="rounded-xl" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-white">{member.displayName}</h4>
                            {member.role === 'leader' && (
                              <Crown className="w-3.5 h-3.5 text-gold-accent" />
                            )}
                          </div>
                          <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                            {member.role}
                          </p>
                        </div>
                      </div>

                      {member.role !== 'leader' && (
                        <button
                          disabled={!!processingId}
                          onClick={() => handleTransferLeadership(member.uid)}
                          className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500 text-purple-500 hover:text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border border-purple-500/20"
                        >
                          {processingId === member.uid ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Make Leader'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ManageGroupModal;
