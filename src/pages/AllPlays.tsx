import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  History, 
  Calendar, 
  MapPin, 
  Crown,
  Trophy
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, or } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';

interface GameSession {
  id: string;
  gameTitle: string;
  gameCover?: string;
  isArtApproved?: boolean;
  date: string;
  location: string;
  players: { name: string; score: number; isWinner: boolean }[];
  notes: string;
}

export default function AllPlays() {
  const { user } = useUser();
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchSessions(user.uid);
    } else {
      navigate('/profile');
    }
  }, [user, navigate]);

  const fetchSessions = async (userId: string) => {
    const path = 'plays';
    try {
      console.warn(
        "Firestore index warning: If 'All Plays' fails to load, ensure you have created " +
        "a composite index for collection 'plays' with: participantIds (Array) and " +
        "createdAt (Descending) in the Firebase console."
      );
      const q = query(
        collection(db, path), 
        or(where('participantIds', 'array-contains', userId), where('userId', '==', userId)),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const sessionList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameSession));
      setSessions(sessionList);
    } catch (error) {
      console.error("Firebase Query Error:", error);
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-accent border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal pb-24 pt-24">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="flex items-center gap-6 mb-12">
          <button 
            onClick={() => navigate('/profile')}
            className="w-12 h-12 bg-white/5 backdrop-blur-md rounded-2xl flex items-center justify-center text-white hover:bg-white/10 transition-all border border-white/10"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
              <History className="w-8 h-8 text-emerald-accent" />
              All Plays
            </h1>
            <p className="text-white/40 font-bold uppercase tracking-widest text-xs mt-1">Your complete gaming history</p>
          </div>
        </div>

        {/* Plays List */}
        <div className="space-y-8">
          {sessions.map((session, idx) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white/5 rounded-[2.5rem] p-8 border border-white/10 shadow-2xl relative group overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-accent/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
              
              <div className="relative">
                <div className="flex flex-col md:flex-row justify-between gap-6 mb-8">
                  <div className="flex gap-6 items-start">
                    {session.gameCover && (
                      <div className="w-20 h-24 shrink-0 rounded-xl overflow-hidden shadow-lg border border-white/5 relative">
                        <img 
                          src={session.gameCover} 
                          alt={session.gameTitle}
                          className={cn(
                            "w-full h-full object-cover",
                            session.isArtApproved ? "" : "blur-md opacity-50 grayscale"
                          )}
                          referrerPolicy="no-referrer"
                        />
                        {!session.isArtApproved && (
                          <div className="absolute inset-0 flex items-center justify-center p-1 text-center bg-gray-900/60 font-black">
                             <span className="text-[10px] uppercase leading-tight text-white/50 tracking-tighter break-all line-clamp-3">{session.gameTitle}</span>
                          </div>
                        )}
                      </div>
                    )}
                  <div>
                    <h2 className="text-2xl font-black text-white mb-2 tracking-tight">{session.gameTitle}</h2>
                    <div className="flex flex-wrap gap-4 text-sm font-bold text-white/30">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-emerald-accent" /> {session.date}
                      </span>
                      {session.location && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-emerald-accent" /> {session.location}
                        </span>
                      )}
                    </div>
                  </div>
                  </div>
                  
                  <div className="flex -space-x-3">
                    {session.players.map((p, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "w-12 h-12 rounded-full border-4 border-charcoal flex items-center justify-center text-xs font-black text-charcoal shadow-lg",
                          p.isWinner ? "bg-gold-accent" : "bg-emerald-accent"
                        )}
                        title={p.name}
                      >
                        {p.name.charAt(0)}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {session.players.map((p, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border transition-all",
                        p.isWinner ? "bg-gold-accent/10 border-gold-accent/20" : "bg-white/5 border-white/5"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn("font-black", p.isWinner ? "text-gold-accent" : "text-white/70")}>
                          {p.name}
                        </span>
                        {p.isWinner && <Crown className="w-4 h-4 text-gold-accent fill-gold-accent" />}
                      </div>
                      <span className="bg-charcoal/40 px-3 py-1 rounded-lg font-black text-white text-sm">
                        {p.score} pts
                      </span>
                    </div>
                  ))}
                </div>

                {session.notes && (
                  <div className="bg-white/5 p-6 rounded-2xl border border-dashed border-white/10">
                    <p className="text-sm text-white/40 font-medium italic leading-relaxed">
                      "{session.notes}"
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {sessions.length === 0 && (
            <div className="text-center py-20 bg-white/5 rounded-[3rem] border-2 border-dashed border-white/10">
              <Trophy className="w-16 h-16 text-white/10 mx-auto mb-4" />
              <h3 className="text-xl font-black text-white mb-2">No plays recorded yet</h3>
              <p className="text-white/20 font-bold">Time to gather the crew and roll some dice!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
