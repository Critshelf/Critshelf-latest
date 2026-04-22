import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Check, Dices } from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import GroupAvatar from './GroupAvatar';

interface EditGroupAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  currentSeed: string;
  onSuccess?: (newSeed: string) => void;
}

const generateSeed = () => Math.random().toString(36).substring(7);

const EditGroupAvatarModal: React.FC<EditGroupAvatarModalProps> = ({ 
  isOpen, 
  onClose, 
  groupId, 
  currentSeed,
  onSuccess 
}) => {
  const [avatarSeed, setAvatarSeed] = useState(currentSeed);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAvatarSeed(currentSeed);
    }
  }, [isOpen, currentSeed]);

  const handleUpdate = async () => {
    if (!groupId || !avatarSeed) return;

    setLoading(true);
    try {
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        avatarSeed: avatarSeed
      });
      
      onSuccess?.(avatarSeed);
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'groups');
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
                <h2 className="text-2xl font-black text-white">Edit Group Avatar</h2>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">Change your community's identity</p>
              </div>
              <button 
                onClick={onClose}
                className="p-3 text-white/20 hover:text-white transition-colors hover:bg-white/5 rounded-2xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-8 no-scrollbar">
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

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-white/5 text-white/40 py-5 rounded-[2rem] font-black text-lg hover:bg-white/10 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading || avatarSeed === currentSeed}
                  onClick={handleUpdate}
                  className="flex-[2] bg-emerald-accent text-charcoal py-5 rounded-[2rem] font-black text-lg shadow-xl hover:shadow-emerald-accent/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-6 h-6" /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default EditGroupAvatarModal;
