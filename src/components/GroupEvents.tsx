import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Calendar, MapPin, Users, Plus, Clock, Trash2, X, Shield, History } from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, orderBy, doc, updateDoc, deleteDoc, getDoc, getDocs, limit, onSnapshot } from 'firebase/firestore';
import { cn } from '../lib/utils';
import CreateEventModal from './CreateEventModal';
import EventDetailsModal from './EventDetailsModal';
import BringGameModal from './BringGameModal';
import { useUser } from '../contexts/UserContext';
import { AnimatePresence } from 'motion/react';
import EventCard, { GroupEvent } from './EventCard';

interface GroupEventsProps {
  groupId: string;
  groupOwnerId?: string;
}

const GroupEvents: React.FC<GroupEventsProps> = ({ groupId, groupOwnerId }) => {
  const { user } = useUser();
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<GroupEvent | null>(null);
  const [bringGameEventId, setBringGameEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId || !user) return;
    // Show upcoming events only
    const now = new Date();
    const q = query(
      collection(db, 'groupEvents'),
      where('groupId', '==', groupId),
      where('dateTime', '>=', now),
      orderBy('dateTime', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data({ serverTimestamps: 'estimate' })
      } as GroupEvent));
      setEvents(eventList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching events:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [groupId, user]);

  useEffect(() => {
    if (selectedEvent) {
      const updatedSelected = events.find(e => e.id === selectedEvent.id);
      if (updatedSelected) {
        setSelectedEvent(updatedSelected);
      }
    }
  }, [events]);

  const handleRSVP = async (eventId: string, currentAttendees: any[], status: string) => {
    if (!user) return;
    
    // Check if status is already set to the same value
    const currentStatus = currentAttendees.find(a => a.userId === user.uid)?.status;
    if (currentStatus === status) return;

    const confirmMessage = status === 'going' ? 'Confirm you are attending this event?' 
                         : status === 'not_going' ? 'Confirm you are not attending this event?'
                         : 'Confirm you are a maybe for this event?';
                         
    let shouldProceed = true;
    try {
      shouldProceed = window.confirm(confirmMessage);
    } catch (e) {
      // Ignore if block
    }
    if (!shouldProceed) return;

    const otherAttendees = currentAttendees.filter(a => a.userId !== user.uid);
    const updatedAttendees = [
      ...otherAttendees,
      { userId: user.uid, displayName: user.displayName || 'Gamer', status }
    ];

    try {
      const eventRef = doc(db, 'groupEvents', eventId);
      await updateDoc(eventRef, {
        attendees: updatedAttendees
      });
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, 'groupEvents');
    }
  };

  const handleCancelEvent = async (event: GroupEvent) => {
    if (!user) return;
    
    const isOwner = user.uid === groupOwnerId;
    const isCreator = user.uid === event.creatorId;

    if (!isCreator && !isOwner) {
      alert("Unauthorized: Only the host or group owner can cancel this event.");
      return;
    }

    try {
      const eventRef = doc(db, 'groupEvents', event.id);
      
      // Try hard delete first
      await deleteDoc(eventRef);
      
      // Manually filter local state to ensure it disappears
      setEvents(prev => prev.filter(e => e.id !== event.id));
    } catch (error: any) {
       console.error("Cancellation Error Detailed:", error);
       
       // Fallback: Try a soft-delete if hard delete failed
       try {
         const eventRef = doc(db, 'groupEvents', event.id);
         await updateDoc(eventRef, { status: 'cancelled' });
         setEvents(prev => prev.filter(e => e.id !== event.id));
       } catch (softError) {
         handleFirestoreError(error, OperationType.DELETE, 'groupEvents');
       }
    }
  };

  return (
    <div className="space-y-8">
      {/* Empty State / Create Event Prompt (Only shows when no events exist) */}
      {!loading && events.length === 0 && (
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gold-accent/5 rounded-[3rem] p-12 text-center border-2 border-dashed border-gold-accent/20 shadow-2xl relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="w-16 h-16 bg-gold-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-gold-accent/20">
              <Calendar className="w-8 h-8 text-gold-accent/40" />
            </div>
            <h2 className="text-2xl font-black mb-2 tracking-tight text-white/90">Schedule a Game Night</h2>
            <p className="text-gold-accent/40 font-medium mb-8 max-w-sm mx-auto italic">"Every great quest begins with a coordinate at the table."</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-gold-accent text-charcoal px-8 py-4 rounded-2xl font-black shadow-lg hover:scale-105 transition-transform inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" /> Host Game Night
            </button>
          </div>
          <div className="absolute -right-10 -bottom-10 opacity-5 rotate-12 pointer-events-none">
            <Calendar className="w-48 h-48 text-gold-accent" />
          </div>
        </motion.div>
      )}

      {/* Events List */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-12 h-12 border-4 border-emerald-accent border-t-transparent rounded-full"
            />
          </div>
        ) : events.length > 0 && (
          events.map(event => (
            <EventCard
              key={event.id}
              event={event}
              user={user}
              groupOwnerId={groupOwnerId}
              onRSVP={handleRSVP}
              onCancel={handleCancelEvent}
              onBringGame={(id) => setBringGameEventId(id)}
              onSelect={(evt) => setSelectedEvent(evt)}
            />
          ))
        )}
      </div>

      <CreateEventModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        groupId={groupId}
      />

      {selectedEvent && (
        <EventDetailsModal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          event={selectedEvent}
        />
      )}

      <BringGameModal 
        isOpen={!!bringGameEventId}
        onClose={() => setBringGameEventId(null)}
        eventId={bringGameEventId || ''}
      />
    </div>
  );
};

export default GroupEvents;
