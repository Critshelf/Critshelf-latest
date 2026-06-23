import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Dices, Loader2, Check, Plus } from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, getDocs, limit, doc, updateDoc, arrayUnion, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useUser } from '../contexts/UserContext';
import { cn } from '../lib/utils';
import GameSearchAndFilter from './GameSearchAndFilter';

interface Game {
  id: string;
  title: string;
  coverImage: string;
  publishers?: string[];
  designers?: string[];
}

interface BringGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
}

const BringGameModal: React.FC<BringGameModalProps> = ({ isOpen, onClose, eventId }) => {
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

  // Search logic
  useEffect(() => {
    const performSearch = async () => {
      if (searchTerm.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        // Simple search logic: filter by title prefix or similar
        // Since Firestore doesn't support full-text search directly without an index,
        // we'll do a simple range query for titles starting with the term.
        const q = query(
          collection(db, 'games'),
          where('title', '>=', searchTerm),
          where('title', '<=', searchTerm + '\uf8ff'),
          limit(20)
        );

        const snap = await getDocs(q);
        const gamesList = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Game));
        setResults(gamesList);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    };

    const timeout = setTimeout(performSearch, 500);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const handleAttachGame = async (game: Game) => {
    if (!user || isSubmitting) return;

    setIsSubmitting(game.id);
    try {
      const eventRef = doc(db, 'groupEvents', eventId);
      const eventSnap = await getDoc(eventRef);
      
      await updateDoc(eventRef, {
        gamesBrought: arrayUnion({
          gameId: game.id,
          title: game.title,
          boxArt: game.coverImage || (game as any).thumbnail || null,
          broughtById: user.uid,
          broughtByName: user.displayName || 'Gamer'
        })
      });

      if (eventSnap.exists()) {
        const eventData = eventSnap.data();
        const activityRef = collection(db, 'activities');
        await addDoc(activityRef, {
          type: 'GAME_BROUGHT',
          actorId: user.uid,
          actorName: user.displayName || 'Gamer',
          targetId: game.id,
          targetName: game.title,
          groupIds: [eventData.groupId],
          metadata: {
            eventId: eventId,
            eventTitle: eventData.title,
            gameCover: game.coverImage || (game as any).thumbnail || null
          },
          createdAt: serverTimestamp()
        });
      }

      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'groupEvents');
    } finally {
      setIsSubmitting(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-charcoal sm:rounded-[3rem] sm:shadow-2xl overflow-hidden border border-white/10 flex flex-col h-[100dvh] sm:h-auto sm:max-h-[80vh]"
          >
            <div className="bg-white/5 p-4 sm:p-8 text-white relative flex-shrink-0 border-b border-white/10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-accent/5 rounded-full -mr-16 -mt-16" />
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50 cursor-pointer text-white/20 hover:text-white transition-colors p-3 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div className="relative flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-accent/10 rounded-2xl shrink-0 flex items-center justify-center backdrop-blur-md border border-emerald-accent/20">
                  <Dices className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-accent" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight">I'm Bringing...</h2>
                  <p className="text-white/40 text-[10px] sm:text-xs font-bold uppercase tracking-widest hidden sm:block">Share your library with the crew</p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-8 flex-1 flex flex-col min-h-0">
              <div className="relative shrink-0 mb-4 sm:mb-6">
                <Search className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-white/20" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search by title..."
                  className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-3 sm:py-5 px-12 sm:px-16 focus:border-emerald-accent outline-none transition-all font-bold text-white placeholder:text-white/20"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {loading && (
                    <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-accent animate-spin" />
                    </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 sm:space-y-4 pb-20 custom-scrollbar">
                {results.length > 0 ? (
                  results.map(game => (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white/5 p-3 sm:p-4 rounded-3xl border border-white/10 flex items-center gap-3 sm:gap-4 group hover:border-emerald-accent/30 transition-all"
                    >
                      <img 
                        src={game.coverImage || undefined} 
                        alt={game.title} 
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-black text-base sm:text-lg leading-tight break-words">{game.title}</h4>
                        <p className="text-white/20 text-[10px] font-black uppercase tracking-widest truncate mt-1">
                          {game.designers?.join(', ') || 'Various Artists'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAttachGame(game)}
                        disabled={!!isSubmitting}
                        className={cn(
                          "px-6 py-3 rounded-xl font-black text-xs transition-all flex items-center gap-2",
                          isSubmitting === game.id
                            ? "bg-emerald-accent text-charcoal"
                            : "bg-white/10 text-white/40 hover:bg-emerald-accent hover:text-charcoal"
                        )}
                      >
                        {isSubmitting === game.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Adding...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" /> I'll Bring This
                          </>
                        )}
                      </button>
                    </motion.div>
                  ))
                ) : searchTerm.length >= 2 && !loading ? (
                    <div className="text-center py-10 opacity-40">
                        <p className="font-bold">No games found for "{searchTerm}"</p>
                    </div>
                ) : (
                    <div className="text-center py-10 opacity-20">
                        <Dices className="w-16 h-16 mx-auto mb-4" />
                        <p className="font-bold uppercase tracking-widest text-sm">Start typing to search games</p>
                    </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BringGameModal;
