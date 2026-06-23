import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  onSnapshot
} from "firebase/firestore";
import { useUser } from "../contexts/UserContext";
import { Loader2, Trophy, MessageCircle, Plus, Star, Calendar, Dices, Share } from "lucide-react";
import UserAvatar from "./UserAvatar";
import { cn } from "../lib/utils";
import LiveGameCover from "./LiveGameCover";
import { Link, useNavigate } from "react-router-dom";
import D20Die from "./D20Die";
import ACBadge from "./ACBadge";
import EventDetailsModal from "./EventDetailsModal";

interface Activity {
  id: string;
  type: string;
  actorId: string;
  actorName: string;
  actorAC?: number;
  targetId: string;
  targetName: string;
  metadata: any;
  createdAt?: any;
  timestamp?: any;
}

export default function SocialHubFeed() {
  const { user } = useUser();
  const [feed, setFeed] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const q = query(
      collection(db, "activities"),
      where("audienceIds", "array-contains", user.uid),
      orderBy("createdAt", "desc"),
      limit(10),
    );

    let isSubscribed = true;
    let unsubscribeFallback: (() => void) | undefined;

    const unsubscribe = onSnapshot(q, (snap) => {
      if (!isSubscribed) return;
      const activities = snap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) }) as Activity,
      );
      setFeed(activities);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === 10);
      setLoading(false);
    }, (error) => {
      console.warn("Index missing for Social Feed, using fallback:", error);
      const qFallback = query(
        collection(db, "activities"),
        orderBy("createdAt", "desc"),
        limit(20),
      );
      unsubscribeFallback = onSnapshot(qFallback, (fallbackSnap) => {
        if (!isSubscribed) return;
        const activities = fallbackSnap.docs
          .filter((d) => (d.data().audienceIds || []).includes(user.uid))
          .map((doc) => ({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) }) as Activity);
        // Sort in memory
        activities.sort((a, b) => {
          const tA = a.createdAt?.toMillis?.() || a.timestamp?.toMillis?.() || 0;
          const tB = b.createdAt?.toMillis?.() || b.timestamp?.toMillis?.() || 0;
          return tB - tA;
        });
        setFeed(activities.slice(0, 10));
        setLastDoc(null); // disable pagination for fallback
        setHasMore(false);
        setLoading(false);
      }, (err) => {
        console.error("Fallback feed error:", err);
        if (isSubscribed) setLoading(false);
      });
    });

    return () => {
      isSubscribed = false;
      unsubscribe();
      if (unsubscribeFallback) unsubscribeFallback();
    };
  }, [user?.uid]);

  const loadMore = async () => {
    if (!user || !lastDoc || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const q = query(
        collection(db, "activities"),
        where("audienceIds", "array-contains", user.uid),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(10),
      );
      const snap = await getDocs(q);
      const newActivities = snap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) }) as Activity,
      );
      setFeed((prev) => [...prev, ...newActivities]);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === 10);
    } catch (error) {
      console.warn("Error loading more feed items:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const handleCardClick = async (activity: Activity) => {
    if (activity.type === "LOG_PLAY" || activity.type === "play_logged") {
      const route = activity.metadata?.playId
        ? `/play/${activity.metadata.playId}`
        : `/game/${activity.targetId}`;
      navigate(route);
    } else if (
      activity.type === "REVIEW_GAME" ||
      activity.type === "RATE_GAME" ||
      activity.type === "COLLECTION_ADD" ||
      activity.type === "review_added" ||
      activity.type === "game_added"
    ) {
      navigate(`/game/${activity.targetId}`);
    } else if (activity.type === "SESSION_SCHEDULED" || activity.type === "GAME_BROUGHT" || activity.type === "GAME_REQUESTED") {
      if (activity.metadata?.eventId) {
        // Look up the event and open the modal
        // But first need getDoc and doc imported
        try {
          const eventSnap = await getDoc(doc(db, "groupEvents", activity.metadata.eventId));
          if (eventSnap.exists()) {
            setSelectedEvent({ id: eventSnap.id, ...eventSnap.data() });
          }
        } catch (error) {
          console.error("Error fetching event:", error);
        }
      }
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 text-emerald-accent animate-spin" />
      </div>
    );
  }

  if (feed.length === 0) {
    return (
      <div className="text-center py-16 bg-white/5 rounded-[3rem] border border-dashed border-white/10">
        <MessageCircle className="w-12 h-12 text-white/10 mx-auto mb-4" />
        <h3 className="text-xl font-black text-white mb-2">No activity yet</h3>
        <p className="text-white/40 font-medium">
          Follow friends or join groups to see their activity
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-[600px] overflow-y-auto space-y-6 pr-2 custom-scrollbar">
      {feed.map((item) => (
        <div
          key={item.id}
          onClick={() => handleCardClick(item)}
          className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 flex gap-4 hover:bg-white/10 transition-colors cursor-pointer"
        >
          {item.type === "SESSION_SCHEDULED" ? (
            <div className="w-12 h-12 bg-white/5 rounded-[1.25rem] flex items-center justify-center shrink-0 border border-white/10 text-emerald-accent shadow-lg shadow-black/20">
              <Calendar className="w-5 h-5" />
            </div>
          ) : (item.type === "GAME_BROUGHT" || item.type === "GAME_REQUESTED") && (item.metadata?.gameCover || item.metadata?.coverImage) ? (
            <LiveGameCover
              gameId={item.targetId?.startsWith('bgg_') ? item.targetId : undefined}
              initialCover={item.metadata?.gameCover || item.metadata?.coverImage}
              alt={item.targetName}
              containerClassName="w-12 h-12 rounded-[1.25rem] shadow-lg border border-white/10 shadow-black/20"
              isApprovalPending={item.metadata?.customImageApproved === false || item.metadata?.isApproved === false}
            />
          ) : (
            <Link
              to={`/profile/${item.actorId}`}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0"
            >
              <UserAvatar
                user={{ uid: item.actorId, displayName: item.actorName }}
                size="md"
                className="rounded-full shadow-lg hover:ring-2 hover:ring-emerald-accent transition-all"
              />
            </Link>
          )}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="text-[10px] uppercase font-black tracking-widest text-white/30 mb-1">
              {(item.createdAt || item.timestamp)
                ?.toDate?.()
                ?.toLocaleDateString() || "Recently"}
            </div>
            {item.type === "LOG_PLAY" && (
              <>
                <div className="flex items-center flex-wrap gap-x-2 text-white text-lg">
                  <Link
                    to={`/profile/${item.actorId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-emerald-accent font-bold hover:underline"
                  >
                    {item.actorName}
                  </Link>
                  <ACBadge value={item.actorAC} size="sm" />
                  <span>logged a play of</span>
                  <Link
                    to={`/game/${item.targetId}`}
                    className="font-bold underline decoration-white/20 hover:decoration-white transition-all"
                  >
                    {item.targetName}
                  </Link>
                </div>
                {item.metadata?.winners && item.metadata.winners.length > 0 && (
                  <p className="text-sm text-gold-accent font-medium mt-1">
                    Winners: {item.metadata.winners.join(", ")}
                  </p>
                )}
                {item.metadata?.score !== undefined && (
                  <p className="text-sm text-white/50 mt-1">
                    Score: {item.metadata.score}/20
                  </p>
                )}
                {item.metadata?.playId && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const shareData = {
                        title: 'CritShelf Session',
                        text: 'Check out this game session on CritShelf!',
                        url: window.location.origin + '/sessions/' + item.metadata.playId
                      };
                      if (navigator.share) {
                        try { await navigator.share(shareData); } catch (err) {}
                      } else {
                        navigator.clipboard.writeText(shareData.url);
                        alert("Link copied!");
                      }
                    }}
                    className="mt-3 flex items-center gap-1.5 text-xs text-white/50 hover:text-emerald-accent font-bold uppercase tracking-widest transition-colors w-fit"
                  >
                    <Share className="w-3 h-3" /> Share Session
                  </button>
                )}
              </>
            )}

            {(item.type === "REVIEW_GAME" || item.type === "RATE_GAME") && (
              <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-x-2 text-white text-lg">
                    <Link
                      to={`/profile/${item.actorId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-emerald-accent font-bold hover:underline"
                    >
                      {item.actorName}
                    </Link>
                    <ACBadge value={item.actorAC} size="sm" />
                    <span>{item.metadata?.text ? "reviewed" : "rated"}</span>
                    <Link
                      to={`/game/${item.targetId}`}
                      className="font-bold underline decoration-white/20 hover:decoration-white transition-all"
                    >
                      {item.targetName}
                    </Link>
                  </div>
                  {item.metadata?.text && (
                    <p className="text-white/70 italic mt-2 text-sm leading-relaxed border-l-2 border-white/10 pl-3">
                      "{item.metadata.text}"
                    </p>
                  )}
                </div>
                {item.metadata?.score !== undefined && (
                  <div className="shrink-0 flex flex-col items-center">
                    <D20Die
                      value={item.metadata.score}
                      theme="gold"
                      size="md"
                    />
                    <span className="text-[8px] uppercase tracking-widest text-gold-accent font-black mt-1">
                      Score / 20
                    </span>
                  </div>
                )}
              </div>
            )}

            {item.type === "COLLECTION_ADD" && (
              <>
                <div className="flex items-center flex-wrap gap-x-2 text-white text-lg">
                  <Link
                    to={`/profile/${item.actorId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-emerald-accent font-bold hover:underline"
                  >
                    {item.actorName}
                  </Link>
                  <ACBadge value={item.actorAC} size="sm" />
                  <span>added</span>
                  <Link
                    to={`/game/${item.targetId}`}
                    className="font-bold underline decoration-white/20 hover:decoration-white transition-all"
                  >
                    {item.targetName}
                  </Link>
                  <span>to their collection</span>
                </div>
                {item.metadata?.shelf && (
                  <span className="mt-2 inline-flex border border-white/20 px-2 py-1 rounded-md text-xs text-white/50 uppercase tracking-widest w-fit">
                    Shelf: {item.metadata.shelf}
                  </span>
                )}
              </>
            )}

            {item.type === "SESSION_SCHEDULED" && (
              <>
                <p className="text-white text-lg mb-2">
                  <strong className="text-emerald-accent">
                    {item.actorName}
                  </strong>{" "}
                  scheduled a session:{" "}
                  <span className="font-bold">
                    "{item.targetName}"
                  </span>
                </p>
                <div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest text-white/40">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {item.metadata?.date &&
                        new Date(item.metadata.date).toLocaleDateString()}
                    </span>
                  </div>
                  {item.metadata?.location && (
                    <div className="flex items-center gap-1.5 line-clamp-1">
                      <span>•</span>
                      <span>{item.metadata.location}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {item.type === "GAME_BROUGHT" && (
              <>
                <p className="text-white text-lg">
                  <strong className="text-emerald-accent">
                    {item.actorName}
                  </strong>{" "}
                  is bringing{" "}
                  <Link
                    to={`/game/${item.targetId}`}
                    className="font-bold underline decoration-white/20 hover:decoration-white transition-all"
                  >
                    {item.targetName}
                  </Link>{" "}
                  for{" "}
                  <span className="font-bold">
                    "{item.metadata?.eventTitle}"
                  </span>
                </p>
              </>
            )}

            {item.type === "GAME_REQUESTED" && (
              <>
                <p className="text-white text-lg mb-2">
                  <strong className="text-emerald-accent">
                    {item.actorName}
                  </strong>{" "}
                  requested to play{" "}
                  <Link
                    to={`/game/${item.targetId}`}
                    className="font-bold underline decoration-white/20 hover:decoration-white transition-all"
                  >
                    {item.targetName}
                  </Link>{" "}
                  at{" "}
                  <span className="font-bold">
                    "{item.metadata?.eventTitle}"
                  </span>
                </p>
              </>
            )}

            {/* Catch-all for unhandled / legacy activity types */}
            {!["LOG_PLAY", "POST_STATUS", "REVIEW_GAME", "RATE_GAME", "COLLECTION_ADD", "SESSION_SCHEDULED", "GAME_BROUGHT", "GAME_REQUESTED"].includes(item.type) && (
              <div className="flex items-center flex-wrap gap-x-2 text-white text-lg">
                <Link
                  to={`/profile/${item.actorId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-emerald-accent font-bold hover:underline"
                >
                  {item.actorName || item.metadata?.userName || "Someone"}
                </Link>
                <ACBadge value={item.actorAC} size="sm" />
                <span>
                 {item.type === "POLL_RESULT" ? `created a poll: ${item.targetName}` :
                  item.type === "group_created" ? `created a new group` :
                  item.type === "new_member" ? `joined a group` :
                  item.type === "play_logged" || item.type === "review_added" || item.type === "game_added" ? `interacted with ${item.targetName || 'an item'}` :
                  `posted an update`}
                </span>
              </div>
            )}
          </div>

          {(item.metadata?.gameCover || item.metadata?.coverImage) && (
            <Link
              to={`/game/${item.targetId}`}
              className="shrink-0 ml-4 hidden sm:block"
            >
              <LiveGameCover
                gameId={item.targetId?.startsWith('bgg_') ? item.targetId : undefined}
                initialCover={item.metadata?.gameCover || item.metadata?.coverImage}
                alt={item.targetName}
                containerClassName="w-16 h-16 rounded-xl border border-white/10"
                isApprovalPending={item.metadata?.customImageApproved === false || item.metadata?.isApproved === false}
              />
            </Link>
          )}
        </div>
      ))}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full py-4 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5 font-black uppercase text-xs tracking-widest transition-colors flex justify-center items-center gap-2"
        >
          {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
          Load More Activity
        </button>
      )}

      {selectedEvent && (
        <EventDetailsModal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          event={selectedEvent}
        />
      )}
    </div>
  );
}
