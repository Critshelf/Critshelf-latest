import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, Check, ArrowRight, Inbox, Loader2 } from "lucide-react";
import { db } from "../lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  limit,
} from "firebase/firestore";
import { useUser } from "../contexts/UserContext";
import {
  Notification,
  markAllAsRead,
  markAsRead,
} from "../services/notificationService";
import { cn } from "../lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface NotificationTrayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationTray({
  isOpen,
  onClose,
}: NotificationTrayProps) {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const notificationsRef = collection(db, "users", user.uid, "notifications");
    const q = query(notificationsRef, orderBy("createdAt", "desc"), limit(20));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Notification[];
        setNotifications(msgs);
        setLoading(false);
      },
      (error: any) => {
        console.error("🔥 Firestore Notification Listener Error:", error);
        if (error?.message?.includes("index")) {
          console.error("🚨 Missing Firebase Index! Click below to create it:");
          console.error(error.message);
        }
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllAsRead(user.uid);
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!user) return;
    if (!notif.isRead) {
      await markAsRead(user.uid, notif.id);
    }

    onClose();

    // 1. Priority: Explicit actionUrl
    if (notif.actionUrl) {
      if (notif.actionUrl.startsWith("http")) {
        window.open(notif.actionUrl, "_blank");
      } else {
        // Fallback for missing user route which seems to be a common issue
        if (
          notif.actionUrl.startsWith("/user/") &&
          !notif.actionUrl.includes("/profile")
        ) {
          navigate("/profile"); // fallback to own profile if we don't have public user pages yet
        } else {
          navigate(notif.actionUrl);
        }
      }
      return;
    }

    // 2. Fallback: Dynamic routing based on type and IDs
    const { type, groupId, gameId, targetId } = notif;

    switch (type) {
      case "group_invite":
        if (groupId) {
          navigate(`/groups/${groupId}`);
        } else {
          console.warn("Missing groupId in group_invite notification");
          navigate("/social?tab=groups");
        }
        break;
      case "groups":
        if (groupId) navigate(`/groups/${groupId}`);
        else navigate("/groups");
        break;
      case "library":
        if (gameId) navigate(`/game/${gameId}`);
        else if (targetId) navigate(`/game/${targetId}`);
        else navigate("/browse");
        break;
      case "social":
        if (targetId)
          navigate("/profile"); // fallback to profile for follow notifications etc
        else navigate("/social");
        break;
      case "moderation":
        if (gameId) navigate(`/game/${gameId}`);
        else navigate("/browse");
        break;
      default:
        navigate("/");
    }
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="absolute bottom-full mb-4 right-0 w-[22rem] bg-charcoal border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden z-[100]"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-accent/10 rounded-xl flex items-center justify-center border border-emerald-accent/20">
                <Bell className="w-4 h-4 text-emerald-accent" />
              </div>
              <h3 className="font-black text-white uppercase tracking-widest text-xs">
                Notifications
              </h3>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 text-[9px] font-black text-white/30 hover:text-emerald-accent uppercase tracking-widest transition-colors"
              >
                <Check className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[25rem] overflow-y-auto no-scrollbar py-2">
            {loading ? (
              <div className="p-12 text-center text-white/20">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest">
                  Scanning Waves...
                </p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-12 text-center py-20 bg-black/20">
                <Inbox className="w-12 h-12 mx-auto mb-4 text-emerald-accent/10" />
                <h4 className="text-white font-black mb-1">
                  Silence is Golden
                </h4>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/20">
                  No new notifications in the queue
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    "w-full p-6 text-left hover:bg-white/5 transition-all relative flex gap-4 border-b border-white/5 last:border-0",
                    !notif.isRead && "bg-emerald-accent/[0.03]",
                  )}
                >
                  {!notif.isRead && (
                    <div className="absolute top-7 left-3 w-1.5 h-1.5 bg-emerald-accent rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  )}

                  <div
                    className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border",
                      notif.type === "moderation"
                        ? "bg-blue-500/10 border-blue-500/20 text-blue-500"
                        : notif.type === "social"
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                          : notif.type === "library"
                            ? "bg-emerald-accent/10 border-emerald-accent/20 text-emerald-accent"
                            : notif.type === "TAGGED_IN_PLAY"
                              ? "bg-gold-accent/10 border-gold-accent/20 text-gold-accent"
                              : "bg-purple-500/10 border-purple-500/20 text-purple-500",
                    )}
                  >
                    <Bell className="w-4 h-4" />
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <h5
                        className={cn(
                          "text-sm font-black leading-tight",
                          notif.isRead ? "text-white/60" : "text-white",
                        )}
                      >
                        {notif.title}
                      </h5>
                      <span className="text-[8px] font-black text-white/10 uppercase tracking-widest whitespace-nowrap pt-1">
                        {notif.createdAt
                          ? formatDistanceToNow(notif.createdAt.toDate(), {
                              addSuffix: true,
                            })
                          : "Just now"}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-white/40 leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>

                    {/* View Details Logic with Safety Check */}
                    {notif.actionUrl ||
                    notif.groupId ||
                    notif.gameId ||
                    notif.targetId ? (
                      <div className="pt-2 flex items-center gap-1.5 text-[9px] font-black text-emerald-accent uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                        View Details <ArrowRight className="w-3 h-3" />
                      </div>
                    ) : (
                      <div className="pt-2 text-[8px] font-black text-white/10 uppercase tracking-widest italic">
                        Info only
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-white/5 border-t border-white/10 text-center">
            <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">
              End of Transmission
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
