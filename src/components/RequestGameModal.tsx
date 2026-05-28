import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Calendar,
  Megaphone,
  Loader2,
  Check,
  Clock,
  MapPin,
} from "lucide-react";
import { db, OperationType, handleFirestoreError } from "../lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useUser } from "../contexts/UserContext";
import { cn } from "../lib/utils";
import { logGroupActivity } from "../lib/socialActivityLogger";

interface GroupEvent {
  id: string;
  title: string;
  location: string;
  dateTime: any;
}

interface RequestGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  game: {
    gameId: string;
    title: string;
    cover: string;
    owners: { uid: string; displayName: string }[];
  };
}

const RequestGameModal: React.FC<RequestGameModalProps> = ({
  isOpen,
  onClose,
  groupId,
  game,
}) => {
  const { user } = useUser();
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && groupId) {
      fetchUpcomingEvents();
    }
  }, [isOpen, groupId]);

  const fetchUpcomingEvents = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const q = query(
        collection(db, "groupEvents"),
        where("groupId", "==", groupId),
        where("dateTime", ">=", now),
        orderBy("dateTime", "asc"),
      );
      const snapshot = await getDocs(q);
      const eventList = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as GroupEvent,
      );
      setEvents(eventList);
    } catch (error) {
      console.error("Error fetching events for request:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || selectedEventIds.length === 0) return;

    setIsSubmitting(true);
    try {
      const batch: any[] = [];
      for (const eventId of selectedEventIds) {
        const event = events.find((e) => e.id === eventId);
        batch.push(
          addDoc(collection(db, "groupRequests"), {
            groupId,
            eventId,
            eventTitle: event?.title || "Unknown Event",
            userId: user.uid,
            userName: user.displayName || "Gamer",
            userAvatar:
              user.photoURL ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
            gameId: game.gameId,
            gameTitle: game.title,
            gameCover: game.cover,
            owners: game.owners,
            createdAt: serverTimestamp(),
            status: "pending",
          }),
        );
      }
      const addedRequests = await Promise.all(batch);

      // Log Group Activity for each event
      for (let i = 0; i < selectedEventIds.length; i++) {
        const eventId = selectedEventIds[i];
        const event = events.find((e) => e.id === eventId);
        const reqRef = addedRequests[i];
        if (event) {
          logGroupActivity({
            type: "GAME_REQUESTED",
            groupId: groupId,
            actorId: user.uid,
            actorName: user.displayName || "Gamer",
            targetId: game.gameId,
            targetName: game.title,
            metadata: {
              eventTitle: event.title,
              eventId: eventId,
              gameCover: game.cover,
              requestId: reqRef.id,
              owners: game.owners,
            },
          });
        }
      }

      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "groupRequests");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return "";
    const d = date.toDate();
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6">
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
              <button
                onClick={onClose}
                className="absolute top-6 right-6 z-50 cursor-pointer text-white/20 hover:text-white transition-colors p-2 bg-white/10 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 bg-gold-accent/10 rounded-2xl flex items-center justify-center border border-gold-accent/20">
                  <Megaphone className="w-6 h-6 text-gold-accent" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight underline decoration-gold-accent/30 decoration-4 underline-offset-4">
                    Request Game
                  </h2>
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-1">
                    Ask the owner to bring it!
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar">
              <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                <img
                  src={game.cover || undefined}
                  className="w-16 h-20 object-cover rounded-lg shadow-md"
                  alt={game.title}
                />
                <div>
                  <h3 className="text-lg font-black text-white mb-1">
                    {game.title}
                  </h3>
                  <p className="text-xs font-bold text-white/30">
                    Owned by {game.owners.map((o) => o.displayName).join(", ")}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-black text-white/20 uppercase tracking-widest ml-2">
                  Select Upcoming Events
                </h4>

                {loading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-8 h-8 text-gold-accent animate-spin" />
                  </div>
                ) : events.length === 0 ? (
                  <div className="text-center py-10 bg-white/5 rounded-3xl border border-dashed border-white/10">
                    <p className="text-white/20 font-bold">
                      No upcoming events scheduled.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {events.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => {
                          setSelectedEventIds((prev) =>
                            prev.includes(event.id)
                              ? prev.filter((id) => id !== event.id)
                              : [...prev, event.id],
                          );
                        }}
                        className={cn(
                          "w-full p-4 rounded-2xl border transition-all text-left flex items-center gap-4",
                          selectedEventIds.includes(event.id)
                            ? "bg-gold-accent/10 border-gold-accent/50 shadow-inner"
                            : "bg-white/5 border-white/10 hover:border-white/20",
                        )}
                      >
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                            selectedEventIds.includes(event.id)
                              ? "bg-gold-accent border-gold-accent text-charcoal"
                              : "border-white/10",
                          )}
                        >
                          {selectedEventIds.includes(event.id) && (
                            <Check className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-white truncate">
                            {event.title}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-black text-white/40 flex items-center gap-1 uppercase tracking-widest">
                              <Calendar className="w-3 h-3" />{" "}
                              {formatDate(event.dateTime)}
                            </span>
                            <span className="text-[10px] font-black text-white/40 flex items-center gap-1 uppercase tracking-widest truncate">
                              <MapPin className="w-3 h-3" /> {event.location}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 pt-0">
              <button
                disabled={isSubmitting || selectedEventIds.length === 0}
                onClick={handleSubmit}
                className="w-full bg-gold-accent text-charcoal py-5 rounded-2xl font-black text-lg shadow-lg hover:shadow-gold-accent/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Sending Request...
                  </>
                ) : (
                  <>
                    <Megaphone className="w-6 h-6" />
                    Send {selectedEventIds.length} Request
                    {selectedEventIds.length !== 1 && "s"}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default RequestGameModal;
