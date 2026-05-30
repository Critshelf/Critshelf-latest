import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Loader2, ArrowLeft } from "lucide-react";
import UserAvatar from "../components/UserAvatar";

export default function PlayDetails() {
  const { id } = useParams<{ id: string }>();
  const [play, setPlay] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchPlay = async () => {
      try {
        const docRef = doc(db, "plays", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPlay({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        console.error("Error fetching play details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPlay();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex justify-center">
        <Loader2 className="w-8 h-8 text-emerald-accent animate-spin" />
      </div>
    );
  }

  if (!play) {
    return (
      <div className="min-h-screen pt-20 text-center px-4">
        <h2 className="text-2xl font-black text-white mb-4">
          Play Session Not Found
        </h2>
        <Link to="/" className="text-emerald-accent hover:underline">
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 md:px-8 max-w-4xl mx-auto">
      <Link
        to={`/game/${play.gameId}`}
        className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {play.gameTitle}
      </Link>

      <div className="bg-white/5 border border-white/10 rounded-[3rem] p-8 md:p-12">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {play.gameCover && (
            <img
              src={play.gameCover}
              alt={play.gameTitle}
              className="w-32 h-32 md:w-48 md:h-48 object-cover rounded-2xl shadow-xl border border-white/10"
            />
          )}

          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
              {play.gameTitle}
            </h1>

            <div className="flex flex-wrap gap-4 mb-8">
              <div className="bg-white/5 px-4 py-2 rounded-xl text-white/70">
                <span className="block text-[10px] uppercase font-black tracking-widest text-white/40">
                  Date
                </span>
                {play.date}
              </div>
              {play.location && (
                <div className="bg-white/5 px-4 py-2 rounded-xl text-white/70">
                  <span className="block text-[10px] uppercase font-black tracking-widest text-white/40">
                    Location
                  </span>
                  {play.location}
                </div>
              )}
              {typeof play.rating === 'number' ? (
                <div className="bg-gold-accent/10 text-gold-accent px-4 py-2 rounded-xl">
                  <span className="block text-[10px] uppercase font-black tracking-widest text-gold-accent/50">
                    Score
                  </span>
                  <span className="font-bold">{play.rating} / 20</span>
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-black text-white mb-4">Players</h3>
              {play.players &&
                play.players.map((player: any, idx: number) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-4 bg-white/5 p-4 rounded-2xl border ${player.isWinner ? "border-gold-accent/50" : "border-white/10"}`}
                  >
                    {player.userId ? (
                      <Link to={`/profile/${player.userId}`}>
                        <UserAvatar
                          user={{
                            uid: player.userId,
                            displayName: player.name,
                          }}
                          size="sm"
                          className="rounded-full shadow-lg"
                        />
                      </Link>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                        <span className="text-white/50 text-sm font-bold">
                          {player.name.charAt(0)}
                        </span>
                      </div>
                    )}

                    <div className="flex-1">
                      <div className="font-bold text-white flex items-center gap-2">
                        {player.userId ? (
                          <Link
                            to={`/profile/${player.userId}`}
                            className="hover:text-emerald-accent transition-colors"
                          >
                            {player.name}
                          </Link>
                        ) : (
                          player.name
                        )}
                        {player.isWinner && (
                          <span className="text-[10px] bg-gold-accent text-charcoal px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                            Winner
                          </span>
                        )}
                      </div>
                      {typeof player.score === 'number' ? (
                        <div className="text-sm text-white/50">
                          Score: {player.score}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
