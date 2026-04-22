import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Plus, Dices } from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useUser } from '../contexts/UserContext';
import { cn } from '../lib/utils';
import GroupAvatar from './GroupAvatar';
import { logActivity } from '../lib/activityLogger';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (groupId: string) => void;
}

const generateSeed = () => Math.random().toString(36).substring(7);
const generateJoinCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, profile } = useUser();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState(generateSeed());
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setLoading(true);
    try {
      const groupId = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
      const groupData = {
        name: name.trim(),
        description: description.trim(),
        avatarSeed: avatarSeed,
        members: [{ userId: user.uid, role: 'leader' }],
        memberIds: [user.uid],
        joinCode: generateJoinCode(),
        isPrivate: isPrivate,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        bannerImage: 'https://picsum.photos/seed/' + avatarSeed + '/1200/400'
      };

      await setDoc(doc(db, 'groups', groupId), groupData);
      
      // Log Activity
      logActivity({
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        avatarSeed: (profile as any)?.avatarSeed || user.uid,
        type: 'group_created',
        groupId,
        groupName: name.trim()
      });

      onSuccess?.(groupId);
      onClose();
      // Reset form
      setName('');
      setDescription('');
      setAvatarSeed(generateSeed());
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'groups');
    } finally {
      setLoading(false);
    }
  };

  const rerollAvatar = () => {
    setAvatarSeed(generateSeed());
  };

  return (
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
              <div>
                <h2 className="text-2xl font-black text-white">Create New Group</h2>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">Start a new gaming community</p>
              </div>
              <button 
                onClick={onClose}
                className="p-3 text-white/20 hover:text-white transition-colors hover:bg-white/5 rounded-2xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-8 no-scrollbar">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-2 ml-4">Group Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. The Board Game Crew"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-accent/20 focus:border-emerald-accent/50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-2 ml-4">Description (Optional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's this group about?"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-accent/20 focus:border-emerald-accent/50 transition-all resize-none h-32"
                  />
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center justify-between group transition-all hover:bg-white/10">
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">Private Group</h4>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">Private groups won't appear in public search and require an invite code.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPrivate(!isPrivate)}
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
              </div>

              <div>
                <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4 ml-4 font-bold">Group Avatar</label>
                <div className="bg-white/5 rounded-[2rem] p-8 border border-white/10 flex flex-col items-center gap-6">
                  <GroupAvatar seed={avatarSeed} size="xl" className="shadow-2xl border-4 border-white/5" />
                  <button
                    type="button"
                    onClick={rerollAvatar}
                    className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black text-white/60 hover:text-white transition-all group"
                  >
                    <Dices className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                    Reroll Avatar
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="w-full bg-emerald-accent text-charcoal py-5 rounded-[2rem] font-black text-lg shadow-xl hover:shadow-emerald-accent/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 mt-4"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-6 h-6" /> Create Group
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CreateGroupModal;
