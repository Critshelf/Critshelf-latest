import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, MapPin, Users, Dices, Plus, Trash2, Loader2, Clock } from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, updateDoc, arrayRemove, collection, query, where, getDocs } from 'firebase/firestore';
import { useUser } from '../contexts/UserContext';
import { cn } from '../lib/utils';
import ACBadge from './ACBadge';
import BringGameModal from './BringGameModal';
import UserAvatar from './UserAvatar';

interface BroughtGame {
  gameId: string;
  title: string;
  boxArt: string;
  broughtById: string;
  broughtByName: string;
}

interface EventAttendee {
  userId: string;
  displayName: string;
  status: string;
}

interface GroupEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  dateTime: any;
  groupId: string;
  creatorId: string;
  attendees: EventAttendee[];
  gamesBrought?: BroughtGame[];
}

interface EventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: GroupEvent | null;
}

const EventDetailsModal: React.FC<EventDetailsModalProps> = ({ isOpen, onClose, event }) => {
  const { user } = useUser();
  const [attendeeProfiles, setAttendeeProfiles] = useState<Record<string, any>>({});
  const [isBringModalOpen, setIsBringModalOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !event) return;

    const fetchAttendeeData = async () => {
      const uids = event.attendees.map(a => a.userId);
      if (uids.length === 0) return;

      const results: Record<string, any> = {};
      
      // Batch fetch users (Firestore in query limit 30)
      const fetchInBatches = async (ids: string[]) => {
        for (let i = 0; i < ids.length; i += 30) {
          const chunk = ids.slice(i, i + 30);
          const q = query(collection(db, 'users'), where('__name__', 'in', chunk));
          const snap = await getDocs(q);
          snap.docs.forEach(doc => {
            const data = doc.data();
            results[doc.id] = {
              attackClass: data.attackClass || 0,
              photoURL: data.photoURL,
              avatarPreference: data.avatarPreference,
              avatarSeed: data.avatarSeed,
              uid: doc.id,
              displayName: data.displayName
            };
          });
        }
      };

      await fetchInBatches(uids);
      setAttendeeProfiles(results);
    };

    fetchAttendeeData();
  }, [event?.attendees, isOpen]);

  const handleRemoveGame = async (game: BroughtGame) => {
    if (isRemoving || !event) return;
    setIsRemoving(game.gameId);
    try {
      const eventRef = doc(db, 'groupEvents', event.id);
      await updateDoc(eventRef, {
        gamesBrought: arrayRemove(game)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'groupEvents');
    } finally {
      setIsRemoving(null);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date.toDate();
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (date: any) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (!event) return null;

  const goingAttendees = event.attendees.filter(a => a.status === 'going');
  const maybeAttendees = event.attendees.filter(a => a.status === 'maybe');

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            className="relative w-full max-w-4xl bg-charcoal rounded-[3.5rem] shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[90vh]"
          >
            {/* Header / Hero Section */}
            <div className="relative bg-white/5 p-10 md:p-12 text-white border-b border-white/10 shrink-0">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-accent/5 rounded-full -mr-32 -mt-32" />
              <button 
                onClick={onClose}
                className="absolute top-8 right-8 z-50 cursor-pointer text-white/20 hover:text-white transition-colors p-4 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/10"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="relative space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="px-4 py-1.5 bg-emerald-accent/10 border border-emerald-accent/20 rounded-lg text-emerald-accent text-[10px] font-black uppercase tracking-widest">
                    Upcoming Event
                  </div>
                </div>

                <div>
                  <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 leading-none">
                    {event.title}
                  </h2>
                  {event.description && (
                    <p className="text-white/40 text-lg font-medium max-w-2xl leading-relaxed">
                      {event.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-6 pt-4">
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-4 rounded-2xl">
                    <Calendar className="w-5 h-5 text-emerald-accent" />
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Date</p>
                      <p className="text-sm font-black text-white">{formatDate(event.dateTime)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-4 rounded-2xl">
                    <Clock className="w-5 h-5 text-emerald-accent" />
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Time</p>
                      <p className="text-sm font-black text-white">{formatTime(event.dateTime)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-4 rounded-2xl">
                    <MapPin className="w-5 h-5 text-emerald-accent" />
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Where</p>
                      <p className="text-sm font-black text-white">{event.location}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-10 md:p-12 space-y-12">
              
              {/* Games Section */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gold-accent/10 rounded-xl flex items-center justify-center border border-gold-accent/20">
                      <Dices className="w-5 h-5 text-gold-accent" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white tracking-tight">Games We're Bringing</h3>
                      <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Coordinate the collection</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsBringModalOpen(true)}
                    className="bg-emerald-accent text-charcoal px-6 py-3 rounded-xl font-black text-xs shadow-lg hover:shadow-emerald-accent/20 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> I'm Bringing a Game
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {event.gamesBrought && event.gamesBrought.length > 0 ? (
                    event.gamesBrought.map((game, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={`${game.gameId}-${idx}`}
                        className="relative bg-white/5 p-4 rounded-3xl border border-white/10 group hover:border-gold-accent/30 transition-all flex items-center gap-4"
                      >
                        <img 
                          src={game.boxArt} 
                          alt={game.title} 
                          className="w-16 h-16 rounded-xl object-cover shrink-0 shadow-lg"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-white text-sm truncate">{game.title}</h4>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="bg-gold-accent/10 text-gold-accent text-[8px] font-black uppercase tracking-widest py-1 px-2 rounded-md">
                              Brought by {game.broughtById === user?.uid ? 'You' : game.broughtByName}
                            </span>
                          </div>
                        </div>
                        {game.broughtById === user?.uid && (
                          <button 
                            onClick={() => handleRemoveGame(game)}
                            disabled={isRemoving === game.gameId}
                            className="p-2 text-white/20 hover:text-rose-500 transition-colors bg-white/5 hover:bg-rose-500/10 rounded-lg group-hover:opacity-100 opacity-0"
                          >
                            {isRemoving === game.gameId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </motion.div>
                    ))
                  ) : (
                    <div className="col-span-full py-12 bg-white/5 rounded-[2.5rem] border-2 border-dashed border-white/5 text-center">
                      <Dices className="w-12 h-12 text-white/10 mx-auto mb-4" />
                      <p className="text-white/20 font-black uppercase tracking-widest text-xs">No games added yet. Coordinate with the group!</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Attendees List */}
              <section className="space-y-6">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-accent/10 rounded-xl flex items-center justify-center border border-emerald-accent/20">
                      <Users className="w-5 h-5 text-emerald-accent" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white tracking-tight">Who's Coming ({goingAttendees.length})</h3>
                      <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Attendee Breakdown</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {goingAttendees.map(attendee => (
                      <div key={attendee.userId} className="bg-white/5 p-4 rounded-3xl border border-white/10 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <UserAvatar 
                            user={attendeeProfiles[attendee.userId] || { uid: attendee.userId, displayName: attendee.displayName }} 
                            size="md" 
                            className="w-10 h-10 rounded-xl border border-white/10 shadow-sm" 
                          />
                          <div className="min-w-0">
                            <h4 className="font-black text-white truncate text-sm">{attendee.userId === user?.uid ? 'You' : attendee.displayName}</h4>
                            <p className="text-[10px] font-black text-emerald-accent uppercase tracking-widest">Going</p>
                          </div>
                        </div>
                        <ACBadge value={attendeeProfiles[attendee.userId]?.attackClass} size="sm" />
                      </div>
                    ))}

                    {maybeAttendees.map(attendee => (
                      <div key={attendee.userId} className="bg-white/5 p-4 rounded-3xl border border-white/10 opacity-60 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <UserAvatar 
                            user={attendeeProfiles[attendee.userId] || { uid: attendee.userId, displayName: attendee.displayName }} 
                            size="md" 
                            className="w-10 h-10 rounded-xl border border-white/10 shadow-sm shrink-0 grayscale" 
                          />
                          <div className="min-w-0">
                            <h4 className="font-black text-white/50 truncate text-sm">{attendee.userId === user?.uid ? 'You' : attendee.displayName}</h4>
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Maybe</p>
                          </div>
                        </div>
                         <ACBadge value={attendeeProfiles[attendee.userId]?.attackClass} size="sm" className="opacity-40" />
                      </div>
                    ))}
                  </div>
              </section>
            </div>
          </motion.div>

          <BringGameModal 
            isOpen={isBringModalOpen}
            onClose={() => setIsBringModalOpen(false)}
            eventId={event.id}
          />
        </div>
      )}
    </AnimatePresence>
  );
};

export default EventDetailsModal;
