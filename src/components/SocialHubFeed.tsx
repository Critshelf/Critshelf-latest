import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { useUser } from "../contexts/UserContext";
import { Loader2, Trophy, MessageCircle, Plus, Star } from "lucide-react";
import UserAvatar from "./UserAvatar";
import { Link, useNavigate } from "react-router-dom";
import D20Die from "./D20Die";
import ACBadge from "./ACBadge";

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

    const fetchFeed = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "activities"),
          where("audienceIds", "array-contains", user.uid),
          orderBy("createdAt", "desc"),
          limit(10),
        );
        const snap = await getDocs(q);
        const activities = snap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Activity,
        );
        setFeed(activities);
        setLastDoc(snap.docs[snap.docs.length - 1] || null);
        setHasMore(snap.docs.length === 10);
      } catch (error) {
        console.error("Error fetching social feed:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
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
        (doc) => ({ id: doc.id, ...doc.data() }) as Activity,
      );
      setFeed((prev) => [...prev, ...newActivities]);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === 10);
    } catch (error) {
      console.error("Error loading more feed items:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCardClick = (activity: Activity) => {
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
          <Link
            to={`/profile/${item.actorId}`}
            onClick={(e) => e.stopPropagation()}
          >
            <UserAvatar
              user={{ uid: item.actorId, displayName: item.actorName }}
              size="md"
              className="rounded-full shadow-lg hover:ring-2 hover:ring-emerald-accent transition-all"
            />
          </Link>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="text-[10px] uppercase font-black tracking-widest text-white/30 mb-1">
              {(item.createdAt || item.timestamp)
                ?.toDate()
                .toLocaleDateString() || "Recently"}
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
                    Score: {item.metadata.score}
                  </p>
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
                    <span>reviewed</span>
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
                      Score
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

            {/* Fallback for other previous legacy activity types if they accidentally got here or are shown */}
            {["play_logged", "review_added", "game_added"].includes(
              item.type,
            ) && (
              <div className="flex items-center flex-wrap gap-x-2 text-white text-lg">
                <Link
                  to={`/profile/${item.actorId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-emerald-accent font-bold hover:underline"
                >
                  {item.actorName || item.metadata?.userName || "Someone"}
                </Link>
                <ACBadge value={item.actorAC} size="sm" />
                <span>did something with an item!</span>
              </div>
            )}
          </div>

          {item.metadata?.gameCover && (
            <Link
              to={`/game/${item.targetId}`}
              className="shrink-0 ml-4 hidden sm:block"
            >
              <img
                src={item.metadata.gameCover}
                alt={item.targetName}
                className="w-16 h-16 rounded-xl object-cover border border-white/10"
                referrerPolicy="no-referrer"
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
    </div>
  );
}
