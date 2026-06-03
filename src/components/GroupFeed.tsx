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
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { useUser } from "../contexts/UserContext";
import { Loader2, MessageCircle } from "lucide-react";
import UserAvatar from "./UserAvatar";
import { Link, useNavigate } from "react-router-dom";
import D20Die from "./D20Die";

interface Activity {
  id: string;
  type: string;
  actorId: string;
  actorName: string;
  targetId: string;
  targetName: string;
  metadata: any;
  createdAt?: any;
  timestamp?: any;
}

interface GroupFeedProps {
  groupId: string;
}

export default function GroupFeed({ groupId }: GroupFeedProps) {
  const { user } = useUser();
  const [feed, setFeed] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (!user || !groupId) return;

    setLoading(true);
    const q = query(
      collection(db, "activities"),
      where("groupIds", "array-contains", groupId),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    let isSubscribed = true;
    let unsubscribeFallback: (() => void) | undefined;

    unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (!isSubscribed) return;
        const activities = snap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) }) as Activity,
        );
        setFeed(activities);
        setLastDoc(snap.docs[snap.docs.length - 1] || null);
        setHasMore(snap.docs.length === 10);
        setLoading(false);
      },
      (error) => {
        console.warn("Index missing for Group Feed, using fallback:", error);
        const qFallback = query(
          collection(db, "activities"),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        unsubscribeFallback = onSnapshot(qFallback, (fallbackSnap) => {
          if (!isSubscribed) return;
          const activities = fallbackSnap.docs
            .filter((d) => (d.data().groupIds || []).includes(groupId))
            .map((doc) => ({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) }) as Activity);
          activities.sort((a, b) => {
            const tA = a.createdAt?.toMillis?.() || a.timestamp?.toMillis?.() || 0;
            const tB = b.createdAt?.toMillis?.() || b.timestamp?.toMillis?.() || 0;
            return tB - tA;
          });
          setFeed(activities.slice(0, 10));
          setLastDoc(null);
          setHasMore(false);
          setLoading(false);
        }, (err) => {
          console.error("Fallback group feed error:", err);
          if (isSubscribed) setLoading(false);
        });
      }
    );

    return () => {
      isSubscribed = false;
      if (unsubscribe) unsubscribe();
      if (unsubscribeFallback) unsubscribeFallback();
    };
  }, [user?.uid, groupId]);

  const loadMore = async () => {
    if (!user || !lastDoc || loadingMore || !hasMore || !groupId) return;

    setLoadingMore(true);
    try {
      const q = query(
        collection(db, "activities"),
        where("groupIds", "array-contains", groupId),
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
        <h3 className="text-xl font-black text-white mb-2">
          No group activity yet
        </h3>
        <p className="text-white/40 font-medium">
          Schedule events, log plays, and request games to build your timeline!
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

            {/* Standard Logic */}
            {item.type === "LOG_PLAY" && (
              <>
                <p className="text-white text-lg">
                  The group played{" "}
                  <Link
                    to={`/game/${item.targetId}`}
                    className="font-bold underline decoration-white/20 hover:decoration-white transition-all"
                  >
                    {item.targetName}
                  </Link>
                </p>
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
                  <p className="text-white text-lg">
                    <Link
                      to={`/profile/${item.actorId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-bold text-emerald-accent hover:underline"
                    >
                      {item.actorName}
                    </Link>{" "}
                    reviewed{" "}
                    <Link
                      to={`/game/${item.targetId}`}
                      className="font-bold underline decoration-white/20 hover:decoration-white transition-all"
                    >
                      {item.targetName}
                    </Link>
                  </p>
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
                <p className="text-white text-lg">
                  <Link
                    to={`/profile/${item.actorId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-bold text-emerald-accent hover:underline"
                  >
                    {item.actorName}
                  </Link>{" "}
                  added{" "}
                  <Link
                    to={`/game/${item.targetId}`}
                    className="font-bold underline decoration-white/20 hover:decoration-white transition-all"
                  >
                    {item.targetName}
                  </Link>{" "}
                  to their collection
                </p>
                {item.metadata?.shelf && (
                  <span className="mt-2 inline-flex border border-white/20 px-2 py-1 rounded-md text-xs text-white/50 uppercase tracking-widest w-fit">
                    Shelf: {item.metadata.shelf}
                  </span>
                )}
              </>
            )}

            {/* Group-Exclusive Logging Types */}
            {item.type === "POLL_RESULT" && (
              <>
                <p className="text-white text-lg">
                  <strong className="text-emerald-accent">
                    {item.actorName}
                  </strong>{" "}
                  started a poll:{" "}
                  <span className="font-bold text-white">
                    "{item.metadata?.pollTitle || item.targetName}"
                  </span>
                </p>
              </>
            )}

            {item.type === "SESSION_SCHEDULED" && (
              <>
                <p className="text-white text-lg">
                  <strong className="text-emerald-accent">
                    {item.actorName}
                  </strong>{" "}
                  scheduled a session:{" "}
                  <span className="font-bold text-white">
                    "{item.metadata?.eventTitle || item.targetName}"
                  </span>
                </p>
                {item.metadata?.dateTime && (
                  <span className="mt-2 inline-flex border border-white/20 px-2 py-1 rounded-md text-xs text-emerald-accent uppercase tracking-widest w-fit">
                    {new Date(item.metadata.dateTime).toLocaleString([], {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                )}
              </>
            )}

            {item.type === "GAME_REQUESTED" && (
              <>
                <p className="text-white text-lg mb-2">
                  <strong className="text-emerald-accent">
                    {item.actorName}
                  </strong>{" "}
                  requested{" "}
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
                {item.metadata?.owners?.some((o: any) => o.uid === user?.uid) &&
                  item.metadata?.requestId && (
                    <button
                      onClick={async () => {
                        try {
                          const reqRef = doc(
                            db,
                            "groupRequests",
                            item.metadata.requestId,
                          );
                          const reqSnap = await getDoc(reqRef);

                          if (reqSnap.exists() && item.metadata?.eventId) {
                            const eventRef = doc(
                              db,
                              "groupEvents",
                              item.metadata.eventId,
                            );
                            const eventSnap = await getDoc(eventRef);

                            if (eventSnap.exists()) {
                              const gamesBrought =
                                eventSnap.data().gamesBrought || [];
                              if (
                                !gamesBrought.find(
                                  (g: any) => g.gameId === item.targetId,
                                )
                              ) {
                                await updateDoc(eventRef, {
                                  gamesBrought: [
                                    ...gamesBrought,
                                    {
                                      gameId: item.targetId,
                                      title: item.targetName,
                                      boxArt: item.metadata.gameCover,
                                      broughtById: user.uid,
                                      broughtByName:
                                        user.displayName || "Gamer",
                                      verified: true,
                                    },
                                  ],
                                });
                              }
                              await updateDoc(reqRef, { status: "accepted" });
                              alert(
                                "Request Accepted! Game added to the event.",
                              );
                            }
                          }
                        } catch (e) {
                          console.error("Failed to accept request:", e);
                        }
                      }}
                      className="bg-emerald-accent text-charcoal px-4 py-2 mt-2 rounded-xl font-black text-xs hover:shadow-emerald-accent/20 transition-all flex items-center gap-2 w-fit"
                    >
                      I'll Bring It!
                    </button>
                  )}
              </>
            )}

            {/* Fallback */}
            {["play_logged", "review_added", "game_added"].includes(
              item.type,
            ) && (
              <p className="text-white text-lg">
                <strong className="text-emerald-accent">
                  {item.actorName || item.metadata?.userName || "Someone"}
                </strong>{" "}
                did something with an item!
              </p>
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
