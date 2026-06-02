import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, BarChart3, SearchX } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import PollCard, { Poll } from './PollCard';

interface ActivePollsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  onScheduleEvent?: (poll: Poll, optionIndex: number) => void;
}

const ActivePollsModal: React.FC<ActivePollsModalProps> = ({ isOpen, onClose, groupId, onScheduleEvent }) => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    // Fetch both active and recently closed polls for viewing
    const q = query(
      collection(db, 'groupPolls'),
      where('groupId', '==', groupId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pollList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Poll));
      setPolls(pollList);
      setLoading(false);
    }, (error) => {
      console.error("ActivePollsModal query error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [groupId, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-charcoal rounded-[3rem] shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[90vh]"
          >
            <div className="bg-white/5 p-8 text-white relative overflow-hidden border-b border-white/10 shrink-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-accent/5 rounded-full -mr-16 -mt-16" />
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 z-50 cursor-pointer text-white/20 hover:text-white transition-colors p-3 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-accent/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-emerald-accent/20">
                  <BarChart3 className="w-6 h-6 text-emerald-accent" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Active Group Polls</h2>
                  <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Cast your vote or check results</p>
                </div>
              </div>
            </div>

            <div className="p-8 overflow-y-auto no-scrollbar space-y-6">
              {loading ? (
                <div className="flex justify-center py-20">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-12 h-12 border-4 border-emerald-accent border-t-transparent rounded-full"
                  />
                </div>
              ) : polls.length === 0 ? (
                <div className="text-center py-20 bg-white/5 rounded-[3rem] border-2 border-dashed border-white/10">
                  <BarChart3 className="w-16 h-16 text-white/10 mx-auto mb-4" />
                  <h3 className="text-xl font-black text-white mb-2">No polls found</h3>
                  <p className="text-white/20 font-bold">Try creating a new scheduling poll!</p>
                </div>
              ) : (
                polls.map(poll => (
                  <PollCard 
                    key={poll.id} 
                    poll={poll} 
                    onScheduleEvent={onScheduleEvent ? (idx) => onScheduleEvent(poll, idx) : undefined}
                  />
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ActivePollsModal;
