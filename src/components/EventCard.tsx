import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, MapPin, Users, Clock, Dices, X, Trash2, Plus } from 'lucide-react';
import { cn } from '../lib/utils';

export interface BroughtGame {
  gameId: string;
  title: string;
  boxArt: string;
  broughtById: string;
  broughtByName: string;
}

export interface GroupEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  dateTime: any;
  groupId: string;
  creatorId: string;
  attendees: { userId: string; displayName: string; status: string }[];
  gamesBrought?: BroughtGame[];
  createdAt?: any;
}

interface EventCardProps {
  event: GroupEvent;
  user: any;
  groupOwnerId?: string;
  onRSVP: (eventId: string, currentAttendees: any[], status: string) => Promise<void>;
  onCancel: (event: GroupEvent) => Promise<void>;
  onBringGame: (eventId: string) => void;
  onSelect: (event: GroupEvent) => void;
}

const EventCard: React.FC<EventCardProps> = ({
  event,
  user,
  groupOwnerId,
  onRSVP,
  onCancel,
  onBringGame,
  onSelect
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
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

  const goingCount = event.attendees?.filter(a => a.status === 'going').length || 0;
  const userStatus = event.attendees?.find(a => a.userId === user?.uid)?.status;

  const handleCancelClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await onCancel(event);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 rounded-[3rem] p-8 shadow-2xl border border-white/10 group hover:border-emerald-accent/30 transition-all cursor-pointer"
      onClick={() => onSelect(event)}
    >
      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-2xl font-black text-white tracking-tight mb-2 group-hover:text-emerald-accent transition-colors">
                {event.title}
              </h3>
              {event.description && (
                <p className="text-white/40 font-medium text-sm line-clamp-2 mb-4">
                  {event.description}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">When</p>
              <div className="space-y-1">
                <p className="font-black text-white text-sm flex items-center gap-2">
                   <Calendar className="w-3 h-3 text-emerald-accent" /> {formatDate(event.dateTime)}
                </p>
                <p className="font-black text-white/40 text-xs flex items-center gap-2">
                   <Clock className="w-3 h-3 text-emerald-accent" /> {formatTime(event.dateTime)}
                </p>
              </div>
            </div>
            
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Where</p>
              <p className="font-black text-white text-sm flex items-center gap-2 truncate">
                <MapPin className="w-3 h-3 text-emerald-accent" /> {event.location}
              </p>
            </div>

            <div className="bg-white/5 p-4 rounded-2xl border border-white/5" title={event.gamesBrought?.map(g => g.title).join(', ')}>
              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Strategy Coord.</p>
              <div className="flex flex-col gap-1">
                 <p className="font-black text-white text-sm flex items-center gap-2">
                  <Users className="w-3 h-3 text-emerald-accent" /> {goingCount} Going
                </p>
                <p className="font-black text-white/40 text-[10px] flex items-center gap-2">
                   <Dices className="w-3 h-3 text-gold-accent" /> {event.gamesBrought?.length || 0} Games
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-2 shrink-0 md:w-48" onClick={e => e.stopPropagation()}>
          <button 
            onClick={() => onRSVP(event.id, event.attendees, 'going')}
            className={cn(
              "py-3 rounded-xl font-black text-xs shadow-lg transition-all active:scale-95",
              userStatus === 'going'
                ? "bg-emerald-accent text-charcoal shadow-emerald-accent/20"
                : "bg-white/5 text-white/40 hover:bg-emerald-accent/20 hover:text-white"
            )}
          >
            I'm Going
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => onRSVP(event.id, event.attendees, 'maybe')}
              className={cn(
                "py-3 rounded-xl font-black text-[10px] transition-all border",
                userStatus === 'maybe'
                  ? "bg-white/10 text-white border-gold-accent/40"
                  : "bg-white/5 text-white/40 hover:bg-white/10 border-white/5"
              )}
            >
              Maybe
            </button>
            <button 
              onClick={() => onRSVP(event.id, event.attendees, 'not_going')}
              className={cn(
                "py-3 rounded-xl font-black text-[10px] transition-all border flex items-center justify-center gap-1",
                userStatus === 'not_going'
                  ? "bg-rose-500/20 text-rose-500 border-rose-500/40"
                  : "bg-white/5 text-white/40 hover:bg-rose-500/20 hover:text-rose-500 border-white/5"
              )}
            >
              <X className="w-3 h-3" /> No
            </button>
          </div>
          
          <div className="mt-2 flex flex-col gap-2">
            <button 
              onClick={() => onBringGame(event.id)}
              className="w-full py-2 bg-emerald-accent/10 hover:bg-emerald-accent/20 border border-emerald-accent/20 rounded-xl text-emerald-accent text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-3 h-3" /> Bring a Game
            </button>

            {(event.creatorId === user?.uid || groupOwnerId === user?.uid) && (
              <div className="flex flex-col gap-2">
                {confirmDeleteId === event.id ? (
                  <div className="space-y-2 p-3 bg-rose-500/10 rounded-xl border border-rose-500/30">
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center">Are you sure?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancelClick}
                        disabled={isDeleting}
                        className="flex-1 py-1.5 bg-rose-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-colors"
                      >
                        {isDeleting ? "..." : "Yes, Cancel"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="flex-1 py-1.5 bg-white/10 text-white/60 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setConfirmDeleteId(event.id)}
                    className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-rose-500 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-3 h-3" /> Cancel Event
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default EventCard;
