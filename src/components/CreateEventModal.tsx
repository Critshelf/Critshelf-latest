import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, MapPin, AlignLeft, Loader2, Plus, Search, Check, RefreshCw, Repeat } from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, updateDoc, collection, addDoc, serverTimestamp, Timestamp, writeBatch, query, where, getDocs, limit } from 'firebase/firestore';
import { useUser } from '../contexts/UserContext';
import { useEffect } from 'react';
import { cn } from '../lib/utils';
import { logActivity } from '../lib/activityLogger';

export interface EventAttendee {
  userId: string;
  displayName: string;
  status: 'going' | 'maybe' | 'not_going';
}

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName?: string;
  initialData?: {
    title?: string;
    dateTime?: string;
    description?: string;
    attendees?: EventAttendee[];
    sourcePollId?: string;
  };
}

const CreateEventModal: React.FC<CreateEventModalProps> = ({ isOpen, onClose, groupId, groupName, initialData }) => {
  const { user, profile } = useUser();
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [location, setLocation] = useState('');
  const [dateTime, setDateTime] = useState(initialData?.dateTime || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recurrence
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<'weekly' | 'bi-weekly' | 'monthly'>('weekly');
  const [occurrenceCount, setOccurrenceCount] = useState(4);

  // Games to bring
  const [broughtGames, setBroughtGames] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Game Search logic
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    const search = async () => {
      setIsSearching(true);
      try {
        const q = query(
          collection(db, 'games'),
          where('title', '>=', searchTerm),
          where('title', '<=', searchTerm + '\uf8ff'),
          limit(5)
        );
        const snap = await getDocs(q);
        const results = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          coverImage: data.coverImage || data.thumbnail || '',
          customImageApproved: data.customImageApproved || data.isApproved || false
        } as any;
      });
      setSearchResults(results);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    };
    const timeout = setTimeout(search, 500);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    if (isOpen && initialData) {
      if (initialData.title) setTitle(initialData.title);
      if (initialData.dateTime) setDateTime(initialData.dateTime);
      if (initialData.description) setDescription(initialData.description || '');
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !location.trim() || !dateTime) return;

    setIsSubmitting(true);
    try {
      const path = 'groupEvents';
      
      const attendees = initialData?.attendees || [{
        userId: user.uid,
        displayName: user.displayName || 'Gamer',
        status: 'going'
      }];

      const gamesBrought = broughtGames.map(g => ({
        gameId: g.id,
        title: g.title,
        boxArt: g.coverImage,
        broughtById: user.uid,
        broughtByName: user.displayName || 'Gamer'
      }));

      const baseEvent = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        groupId,
        creatorId: user.uid,
        attendees,
        gamesBrought,
        createdAt: serverTimestamp()
      };

      const startDateTime = new Date(dateTime);
      const batch = writeBatch(db);
      const count = isRecurring ? Math.min(occurrenceCount, 8) : 1;

      for (let i = 0; i < count; i++) {
        const eventDate = new Date(startDateTime);
        if (recurrenceFreq === 'weekly') {
          eventDate.setDate(startDateTime.getDate() + (i * 7));
        } else if (recurrenceFreq === 'bi-weekly') {
          eventDate.setDate(startDateTime.getDate() + (i * 14));
        } else if (recurrenceFreq === 'monthly') {
          eventDate.setMonth(startDateTime.getMonth() + i);
        }

        const newEventRef = doc(collection(db, path));
        batch.set(newEventRef, {
          ...baseEvent,
          dateTime: Timestamp.fromDate(eventDate)
        });
      }

      await batch.commit();

      // Log Activity
      logActivity({
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        avatarSeed: (profile as any)?.avatarSeed || user.uid,
        type: 'event_created',
        groupId,
        groupName: groupName,
        metadata: {
          eventTitle: title.trim(),
          dateTime: dateTime
        }
      });

      // If this was created from a poll, close the poll
      if (initialData?.sourcePollId) {
        const pollRef = doc(db, 'groupPolls', initialData.sourcePollId);
        await updateDoc(pollRef, {
          closeDate: serverTimestamp() // Close immediately
        });
      }

      setTitle('');
      setDescription('');
      setLocation('');
      setDateTime('');
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'groupEvents');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            className="relative w-full max-w-lg bg-charcoal rounded-[3rem] shadow-2xl overflow-hidden border border-white/10"
          >
            <div className="bg-white/5 p-8 text-white relative overflow-hidden border-b border-white/10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-accent/5 rounded-full -mr-16 -mt-16" />
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 z-50 cursor-pointer text-white/20 hover:text-white transition-colors p-3 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-accent/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-emerald-accent/20">
                  <Calendar className="w-6 h-6 text-emerald-accent" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Host an Event</h2>
                  <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Gather the crew in person</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar">
              <div className="space-y-2">
                <label className="text-xs font-black text-white/20 uppercase tracking-widest ml-2">Event Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Friday Night Dice"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-emerald-accent outline-none transition-all font-bold text-white placeholder:text-white/20"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-white/20 uppercase tracking-widest ml-2">Date & Time</label>
                <div className="relative">
                  <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-accent pointer-events-none" />
                  <input
                    required
                    type="datetime-local"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 focus:border-emerald-accent outline-none transition-all font-bold text-white [color-scheme:dark]"
                    value={dateTime}
                    onChange={e => setDateTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-white/20 uppercase tracking-widest ml-2">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-accent pointer-events-none" />
                  <input
                    required
                    type="text"
                    placeholder="e.g. The Game Parlor or My Place"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 focus:border-emerald-accent outline-none transition-all font-bold text-white placeholder:text-white/20"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-white/20 uppercase tracking-widest ml-2">Description (Optional)</label>
                <div className="relative">
                  <AlignLeft className="absolute left-6 top-4 w-5 h-5 text-emerald-accent pointer-events-none" />
                  <textarea
                    rows={3}
                    placeholder="Provide some details about the event..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 focus:border-emerald-accent outline-none transition-all font-bold text-white placeholder:text-white/20 resize-none"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>
              </div>

              {/* Games Selection */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between ml-2">
                  <label className="text-xs font-black text-white/20 uppercase tracking-widest">Games To Bring (Optional)</label>
                  <span className="text-[10px] font-black text-emerald-accent uppercase tracking-widest bg-emerald-accent/10 px-2 py-0.5 rounded-md">Host List</span>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input
                    type="text"
                    placeholder="Search for games you're bringing..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 focus:border-emerald-accent outline-none transition-all font-bold text-sm text-white placeholder:text-white/20"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  {isSearching && <Loader2 className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-accent animate-spin" />}
                </div>

                <AnimatePresence>
                  {searchResults.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-charcoal border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                    >
                      {searchResults.map(game => (
                        <button
                          key={game.id}
                          type="button"
                          onClick={() => {
                            if (!broughtGames.find(g => g.id === game.id)) {
                              setBroughtGames([...broughtGames, game]);
                            }
                            setSearchTerm('');
                            setSearchResults([]);
                          }}
                          className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                        >
                          <img src={game.coverImage || undefined} className="w-10 h-10 rounded-lg object-cover" alt={game.title} />
                          <div className="flex-1 text-left">
                            <p className="font-black text-white text-sm truncate">{game.title}</p>
                            <p className="text-[10px] text-white/20 font-bold uppercase">{game.publishers?.[0] || 'Game Studio'}</p>
                          </div>
                          <Plus className="w-4 h-4 text-emerald-accent" />
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-wrap gap-2">
                  {broughtGames.map(game => (
                    <div 
                      key={game.id}
                      className="bg-emerald-accent/10 border border-emerald-accent/20 rounded-xl p-2 pr-3 flex items-center gap-3"
                    >
                      <img src={game.coverImage || undefined} className="w-8 h-8 rounded-lg object-cover" alt={game.title} />
                      <span className="text-[10px] font-black text-white truncate max-w-[100px]">{game.title}</span>
                      <button 
                        type="button"
                        onClick={() => setBroughtGames(broughtGames.filter(g => g.id !== game.id))}
                        className="text-emerald-accent/40 hover:text-rose-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recurrence Section */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between ml-2">
                  <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-emerald-accent" />
                    <label className="text-xs font-black text-white/20 uppercase tracking-widest">Recurring Schedule</label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRecurring(!isRecurring)}
                    className={cn(
                      "relative w-12 h-6 rounded-full transition-colors duration-200 outline-none",
                      isRecurring ? "bg-emerald-accent" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200",
                      isRecurring ? "translate-x-6" : "translate-x-0"
                    )} />
                  </button>
                </div>

                <AnimatePresence>
                  {isRecurring && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-2">Frequency</label>
                          <select 
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 focus:border-emerald-accent outline-none text-white font-bold text-sm"
                            value={recurrenceFreq}
                            onChange={(e: any) => setRecurrenceFreq(e.target.value)}
                          >
                            <option value="weekly" className="bg-charcoal">Weekly</option>
                            <option value="bi-weekly" className="bg-charcoal">Bi-Weekly</option>
                            <option value="monthly" className="bg-charcoal">Monthly</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-2">Total Occurrences</label>
                          <input 
                            type="number"
                            min={2}
                            max={8}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 focus:border-emerald-accent outline-none text-white font-bold text-sm"
                            value={occurrenceCount}
                            onChange={e => setOccurrenceCount(parseInt(e.target.value) || 2)}
                          />
                        </div>
                      </div>
                      <div className="bg-emerald-accent/5 p-4 rounded-2xl border border-emerald-accent/10">
                        <p className="text-[10px] font-bold text-emerald-accent uppercase tracking-widest flex items-center gap-2">
                           <RefreshCw className="w-3 h-3 animate-spin-slow" /> Batch Generation Active
                        </p>
                        <p className="text-xs text-white/40 mt-1 font-medium">This will create {occurrenceCount} separate events in your group schedule.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                disabled={isSubmitting}
                type="submit"
                className="w-full bg-emerald-accent text-charcoal py-5 rounded-2xl font-black text-lg shadow-lg hover:shadow-emerald-accent/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Posting Event...
                  </>
                ) : (
                  <>
                    <Calendar className="w-6 h-6" />
                    Create Event
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

export default CreateEventModal;
