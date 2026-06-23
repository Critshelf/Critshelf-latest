import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Loader2, ArrowLeft, Share, MapPin, Clock, Quote, Crown, Dices, MessageSquare, Send, Sparkles, Trash2 } from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import { useUser } from "../contexts/UserContext";

export default function PlayDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [play, setPlay] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useUser();
  const [pendingClaims, setPendingClaims] = useState<Record<number, boolean>>({});
  
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    if (!id) return;
    let unsubscribeComments: (() => void) | undefined;

    const fetchPlay = async () => {
      try {
        const docRef = doc(db, "plays", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const playData = { id: docSnap.id, ...docSnap.data() } as any;
          
          if (!playData.gameCover && playData.gameId) {
             const gameSnap = await getDoc(doc(db, "games", playData.gameId));
             if (gameSnap.exists()) {
               playData.gameCover = gameSnap.data().thumbnailUrl || gameSnap.data().coverUrl || gameSnap.data().coverImage;
             }
          }
          setPlay(playData);
        }
      } catch (error) {
        console.error("Error fetching play details:", error);
      } finally {
        setLoading(false);
      }
    };

    const setupComments = () => {
      const q = query(collection(db, "plays", id, "comments"), orderBy("createdAt", "asc"));
      unsubscribeComments = onSnapshot(q, (snap) => {
        setComments(snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })));
      }, (err) => {
        console.error("Error fetching comments:", err);
      });
    };

    fetchPlay();
    setupComments();
    
    return () => {
      if (unsubscribeComments) unsubscribeComments();
    };
  }, [id]);

  const handleShare = async () => {
    const shareData = {
      title: 'CritShelf Session',
      text: 'Check out this game session on CritShelf!',
      url: window.location.origin + '/sessions/' + play.id
    };
    
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(shareData.url);
      alert("Link copied!");
    }
  };

  const handleClaimPlayer = async (playerIndex: number, playerName: string) => {
    if (!user || !play) return;
    
    setPendingClaims(prev => ({ ...prev, [playerIndex]: true }));
    
    try {
      const claimRef = collection(db, "claim_approvals");
      await addDoc(claimRef, {
        sessionId: play.id,
        gameId: play.gameId,
        guestIndex: playerIndex,
        guestName: playerName,
        claimedByUserId: user.uid,
        loggerId: play.userId,
        status: "pending",
        createdAt: new Date()
      });
      alert("Claim request sent to the logger!");
    } catch (err) {
      console.error(err);
      alert("Failed to send claim request.");
      setPendingClaims(prev => ({ ...prev, [playerIndex]: false }));
    }
  };

  const isLogger = Boolean(user && play?.userId === user.uid);

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

  const handleGoBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(`/game/${play.gameId}`);
    }
  };

  const handlePostComment = async () => {
    if (!user || !newComment.trim() || postingComment) return;
    
    setPostingComment(true);
    try {
      await addDoc(collection(db, "plays", play.id, "comments"), {
        userId: user.uid,
        userName: profile?.displayName || profile?.username || user.displayName || "Anonymous",
        text: newComment.trim(),
        createdAt: serverTimestamp(),
      });
      setNewComment("");
    } catch (err) {
      console.error("Failed to post comment:", err);
      alert("Failed to post comment.");
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    try {
      await deleteDoc(doc(db, "plays", play.id, "comments", commentId));
    } catch (err) {
      console.error("Failed to delete comment:", err);
      alert("Failed to delete comment.");
    }
  };

  // Sort players by score
  const sortedPlayers = play.players ? [...play.players] : [];
  sortedPlayers.sort((a, b) => {
    const scoreA = typeof a.score === 'number' ? a.score : (parseFloat(a.score) || 0);
    const scoreB = typeof b.score === 'number' ? b.score : (parseFloat(b.score) || 0);
    return scoreB - scoreA;
  });

  return (
    <div className="min-h-screen bg-charcoal">
      {/* Hero Section */}
      <div className="relative w-full h-64 md:h-80 bg-charcoal overflow-hidden border-b border-white/5">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent z-10" />
        <div className="absolute top-4 inset-x-4 md:inset-x-8 z-20 flex items-center justify-between">
          <button
            onClick={handleGoBack}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all border border-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 bg-black/40 backdrop-blur-md hover:bg-emerald-accent/20 text-emerald-accent px-4 py-2 rounded-full transition-all font-black text-xs uppercase tracking-widest border border-white/10"
          >
            <Share className="w-4 h-4" /> Share
          </button>
        </div>

        {play.gameCover ? (
          <div className="absolute inset-0">
             <div className="absolute inset-0 bg-black/50 backdrop-blur-3xl z-0" />
             <img src={play.gameCover} alt="Cover Blur" className="w-full h-full object-cover opacity-30 z-0" />
          </div>
        ) : null}

        <div className="absolute inset-0 flex items-center justify-center z-10 px-4 pt-10">
           <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left max-w-4xl w-full">
              {play.gameCover && (
                <img
                  src={play.gameCover}
                  alt={play.gameTitle}
                  className="w-32 h-32 md:w-48 md:h-48 object-cover rounded-2xl shadow-2xl border border-white/10 shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                {play.date && (
                  <span className="inline-block text-xs uppercase font-black tracking-widest text-emerald-accent mb-2">
                    {new Date(play.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                )}
                <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none mb-4 drop-shadow-lg">
                  {play.gameTitle}
                </h1>
                
                <div className="flex flex-wrap items-center gap-3">
                  {typeof play.rating === 'number' && (
                    <div className="inline-flex items-center gap-2 bg-emerald-accent/20 border border-emerald-accent/30 text-emerald-accent px-4 py-1.5 rounded-full font-black text-sm">
                      <Dices className="w-4 h-4" /> Session Rating: {play.rating} / 20
                    </div>
                  )}
                  {play.vibeTag && (
                    <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 px-4 py-1.5 rounded-full font-black text-sm uppercase tracking-widest text-[10px]">
                      <Sparkles className="w-3 h-3" /> {play.vibeTag}
                    </div>
                  )}
                </div>
              </div>
           </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-12 space-y-12">
        {/* Metadata Grid */}
        <div className="flex flex-wrap gap-4">
           {play.location && (
             <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 flex-1 min-w-[200px]">
                <div className="w-10 h-10 rounded-full bg-emerald-accent/10 flex items-center justify-center text-emerald-accent shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-black tracking-widest text-white/40">Location</span>
                  <span className="text-white font-medium">{play.location}</span>
                </div>
             </div>
           )}
           {play.duration && (
             <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 flex-1 min-w-[200px]">
                <div className="w-10 h-10 rounded-full bg-emerald-accent/10 flex items-center justify-center text-emerald-accent shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-black tracking-widest text-white/40">Duration</span>
                  <span className="text-white font-medium">{play.duration}</span>
                </div>
             </div>
           )}
           {Array.isArray(play.includedExpansions) && play.includedExpansions.length > 0 && (
             <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex-1 min-w-[200px]">
                <span className="block text-[10px] uppercase font-black tracking-widest text-white/40 mb-3">Expansions</span>
                <div className="flex flex-wrap gap-2">
                   {play.includedExpansions.map((exp: any, i: number) => (
                     <span key={i} className="bg-white/10 border border-white/10 text-white/80 px-3 py-1 rounded-full text-xs font-medium">
                       {typeof exp === 'string' ? exp : exp.title || exp.id}
                     </span>
                   ))}
                </div>
             </div>
           )}
           {(play.notes || play.comments) && (
             <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 relative mt-4">
                <Quote className="absolute top-4 left-4 w-12 h-12 text-white/5" />
                <p className="text-white/80 font-serif italic text-lg leading-relaxed relative z-10 pl-4 border-l-2 border-emerald-accent/50">
                  "{play.notes || play.comments}"
                </p>
             </div>
           )}
        </div>

        {/* Player Roster */}
        <div>
          <h3 className="text-xl font-black text-white uppercase tracking-widest mb-6 px-1 text-[10px]">Player Roster</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sortedPlayers.map((player: any) => {
              const originalIndex = play.players.findIndex((p: any) => p === player);
              return (
                <div
                  key={originalIndex}
                  className={`relative flex items-center gap-4 bg-charcoal-light p-5 rounded-3xl border transition-all ${
                    player.isWinner ? "border-gold-accent ring-1 ring-gold-accent/50 shadow-lg shadow-gold-accent/10" : "border-white/10"
                  }`}
                >
                  {player.isWinner && (
                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gold-accent border-4 border-charcoal flex items-center justify-center shadow-lg">
                      <Crown className="w-4 h-4 text-charcoal" />
                    </div>
                  )}

                  {player.userId ? (
                    <Link to={`/profile/${player.userId}`} className="shrink-0">
                      <UserAvatar
                        user={{
                          uid: player.userId,
                          displayName: player.name,
                        }}
                        size="md"
                        className="rounded-full shadow-lg"
                      />
                    </Link>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/5">
                      <span className="text-white/40 text-lg font-black uppercase">
                        {player.name.charAt(0)}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {player.userId ? (
                        <Link
                          to={`/profile/${player.userId}`}
                          className="font-bold text-white hover:text-emerald-accent transition-colors truncate"
                        >
                          {player.name}
                        </Link>
                      ) : (
                        <span className="font-bold text-white truncate">{player.name}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      {(typeof player.score === 'number' || (typeof player.score === 'string' && player.score.trim() !== '')) ? (
                        <div className="text-sm font-medium text-white/50">
                          Score <span className="text-white font-bold">{player.score}</span>
                        </div>
                      ) : <div />}

                      {!player.userId && user && !isLogger && (
                        <button
                          onClick={() => handleClaimPlayer(originalIndex, player.name)}
                          disabled={pendingClaims[originalIndex]}
                          className="text-[10px] bg-white/10 hover:bg-emerald-accent hover:text-charcoal px-3 py-1.5 rounded-full font-black uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {pendingClaims[originalIndex] ? "Pending" : "Claim"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comments Section */}
        <div className="pt-8 border-t border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <MessageSquare className="w-5 h-5 text-emerald-accent" />
            <h3 className="text-xl font-black text-white uppercase tracking-widest text-[10px]">Session Comments</h3>
            <span className="bg-white/10 text-white/50 px-2 py-0.5 rounded-full text-[10px] font-bold">
              {comments.length}
            </span>
          </div>

          <div className="space-y-6 mb-8">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-4 group">
                <Link to={`/profile/${comment.userId}`} className="shrink-0 mt-1">
                  <UserAvatar
                    user={{ uid: comment.userId, displayName: comment.userName }}
                    size="sm"
                    className="rounded-full shadow-lg"
                  />
                </Link>
                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 relative">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <Link to={`/profile/${comment.userId}`} className="font-bold text-white hover:text-emerald-accent text-sm">
                      {comment.userName}
                    </Link>
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                      {comment.createdAt?.toDate ? comment.createdAt.toDate().toLocaleDateString() : 'Just now'}
                    </span>
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{comment.text}</p>
                  
                  {(user?.uid === comment.userId || user?.uid === play.userId) && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 hover:text-white"
                      title="Delete comment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <div className="text-center py-8">
                <p className="text-white/40 text-sm font-medium">No comments yet. Be the first!</p>
              </div>
            )}
          </div>

          {user ? (
            <div className="flex gap-4">
              <UserAvatar user={user} size="sm" className="rounded-full shrink-0 mt-1" />
              <div className="flex-1 relative">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Drop a comment..."
                  className="w-full bg-charcoal-light border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-emerald-accent/50 focus:ring-1 focus:ring-emerald-accent/50 resize-none min-h-[100px] text-sm"
                />
                <button
                  onClick={handlePostComment}
                  disabled={!newComment.trim() || postingComment}
                  className="absolute bottom-3 right-3 bg-emerald-accent hover:bg-emerald-accent/80 text-charcoal px-4 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
                >
                  {postingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Post
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <p className="text-white/50 mb-4">Log in to leave a comment</p>
              <Link to="/auth" className="inline-block bg-emerald-accent hover:bg-emerald-accent/80 text-charcoal px-6 py-2 rounded-xl font-black uppercase tracking-widest text-[10px]">
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

