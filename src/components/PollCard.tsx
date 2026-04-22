import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, HelpCircle, Users, CalendarPlus } from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';

export interface PollVote {
  userId: string;
  status: 'yes' | 'no' | 'maybe';
  userName: string;
  userAvatar: string;
}

export interface Poll {
  id: string;
  groupId: string;
  title: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  options: string[];
  votes: { [optionIndex: string]: PollVote[] };
  closeDate: any;
  createdAt: any;
}

interface PollCardProps {
  poll: Poll;
  onScheduleEvent?: (optionIndex: number) => void;
}

const PollCard: React.FC<PollCardProps> = ({ poll, onScheduleEvent }) => {
  const { user } = useUser();
  const isClosed = poll.closeDate ? poll.closeDate.toDate() < new Date() : false;

  const handleVote = async (optionIndex: number, status: 'yes' | 'no' | 'maybe') => {
    if (!user || isClosed) return;

    const pollRef = doc(db, 'groupPolls', poll.id);
    const optionKey = optionIndex.toString();
    const currentOptionVotes = poll.votes[optionKey] || [];
    
    // Check if user already has the SAME vote status
    const existingVote = currentOptionVotes.find(v => v.userId === user.uid);
    if (existingVote?.status === status) {
      // Toggle off if they click the same button
      const newVotes = currentOptionVotes.filter(v => v.userId !== user.uid);
      try {
        await updateDoc(pollRef, {
          [`votes.${optionKey}`]: newVotes
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'groupPolls');
      }
      return;
    }

    // Otherwise, replace current vote for this specific option
    const newVotes = [
      ...currentOptionVotes.filter(v => v.userId !== user.uid),
      {
        userId: user.uid,
        status,
        userName: user.displayName || 'Gamer',
        userAvatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`
      }
    ];

    try {
      await updateDoc(pollRef, {
        [`votes.${optionKey}`]: newVotes
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'groupPolls');
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white/5 rounded-[3rem] p-8 shadow-2xl border border-white/10 relative",
        isClosed && "opacity-60"
      )}
    >
      {isClosed && (
        <div className="absolute top-8 right-8 z-10 px-4 py-1 bg-rose-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
          Poll Closed
        </div>
      )}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white/10 shadow-lg">
            <img src={poll.creatorAvatar} className="w-full h-full object-cover" alt={poll.creatorName} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white tracking-tight">{poll.title}</h3>
            <p className="text-white/20 font-bold text-[10px] uppercase tracking-widest">
              Created by <span className="text-emerald-accent">{poll.creatorName}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {poll.options.map((option, index) => {
          const optionKey = index.toString();
          const votes = poll.votes[optionKey] || [];
          const userVote = votes.find(v => v.userId === user?.uid)?.status;
          
          const yesVotes = votes.filter(v => v.status === 'yes');
          const noVotes = votes.filter(v => v.status === 'no');
          const maybeVotes = votes.filter(v => v.status === 'maybe');

          return (
            <div key={index} className="bg-white/5 rounded-3xl p-6 border border-white/5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-lg font-black text-white">{option}</p>
                    
                    {user?.uid === poll.creatorId && !isClosed && onScheduleEvent && (
                      <button
                        onClick={() => onScheduleEvent(index)}
                        title="Schedule as Event"
                        className="p-2 bg-emerald-accent/10 text-emerald-accent rounded-xl hover:bg-emerald-accent transition-all border border-emerald-accent/20 hover:text-charcoal"
                      >
                        <CalendarPlus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Voting Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={isClosed}
                      onClick={() => handleVote(index, 'yes')}
                      className={cn(
                        "flex-1 h-12 rounded-xl flex items-center justify-center gap-2 transition-all font-black text-xs uppercase tracking-widest",
                        isClosed ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                        userVote === 'yes'
                          ? "bg-emerald-accent text-charcoal shadow-lg shadow-emerald-accent/20"
                          : "bg-white/5 text-emerald-accent/40 hover:bg-emerald-accent/10 hover:text-emerald-accent"
                      )}
                    >
                      <Check className="w-4 h-4" />
                      Yes
                    </button>
                    <button
                      disabled={isClosed}
                      onClick={() => handleVote(index, 'maybe')}
                      className={cn(
                        "flex-1 h-12 rounded-xl flex items-center justify-center gap-2 transition-all font-black text-xs uppercase tracking-widest",
                        isClosed ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                        userVote === 'maybe'
                          ? "bg-gold-accent text-charcoal shadow-lg shadow-gold-accent/20"
                          : "bg-white/5 text-gold-accent/40 hover:bg-gold-accent/10 hover:text-gold-accent"
                      )}
                    >
                      <HelpCircle className="w-4 h-4" />
                      Maybe
                    </button>
                    <button
                      disabled={isClosed}
                      onClick={() => handleVote(index, 'no')}
                      className={cn(
                        "flex-1 h-12 rounded-xl flex items-center justify-center gap-2 transition-all font-black text-xs uppercase tracking-widest",
                        isClosed ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                        userVote === 'no'
                          ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                          : "bg-white/5 text-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500"
                      )}
                    >
                      <X className="w-4 h-4" />
                      No
                    </button>
                  </div>
                </div>

                {/* Voters Summary */}
                <div className="flex flex-col gap-3 min-w-[140px]">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-emerald-accent">Yes ({yesVotes.length})</span>
                    <span className="text-gold-accent">Maybe ({maybeVotes.length})</span>
                  </div>
                  
                  <div className="flex -space-x-2">
                    {votes.slice(0, 5).map((v, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "w-8 h-8 rounded-full border-2 border-charcoal overflow-hidden shadow-sm",
                          v.status === 'yes' ? "ring-2 ring-emerald-accent/50" : 
                          v.status === 'maybe' ? "ring-2 ring-gold-accent/50" : "ring-2 ring-rose-500/50"
                        )}
                        title={`${v.userName} (${v.status})`}
                      >
                        <img src={v.userAvatar} className="w-full h-full object-cover" alt={v.userName} />
                      </div>
                    ))}
                    {votes.length > 5 && (
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black text-white border-2 border-charcoal">
                        +{votes.length - 5}
                      </div>
                    )}
                    {votes.length === 0 && (
                      <p className="text-[10px] font-black text-white/10 uppercase tracking-widest italic">No votes yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default PollCard;
