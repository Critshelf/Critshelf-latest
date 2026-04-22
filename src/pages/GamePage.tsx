import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Users, 
  Clock, 
  Calendar, 
  Star, 
  MessageCircle, 
  ChevronLeft,
  Share2,
  Heart,
  Send,
  Plus,
  ChevronDown,
  Check,
  Trophy,
  Dices,
  Shield,
  Image as ImageIcon,
  Loader2,
  X,
  Layers,
  Smile,
  Flag
} from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, getDoc, collection, query, getDocs, limit, where, setDoc, updateDoc, serverTimestamp, addDoc, orderBy, startAt, endAt } from 'firebase/firestore';
import { Game } from '../components/GameCard';
import { cn, formatPlayTime } from '../lib/utils';
import { AnimatePresence } from 'motion/react';
import { MOCK_GAMES, VIBE_OPTIONS } from '../constants';
import LogPlayModal from '../components/LogPlayModal';
import ReportErrorModal from '../components/ReportErrorModal';
import { D20Icon, VibeSystem } from '../components/GameDetails/Ratings';
import D20Die from '../components/D20Die';
import DCShield from '../components/DCShield';
import GameTitleWithDC from '../components/GameTitleWithDC';
import ACBadge from '../components/ACBadge';
import { calculateBaseDC, calculateFinalDC } from '../lib/dcUtils';
import { useUser } from '../contexts/UserContext';
import UserAvatar from '../components/UserAvatar';
import { logActivity } from '../lib/activityLogger';

interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  avatarPreference?: 'google' | 'dicebear';
  avatarSeed?: string;
  score: number;
  text: string;
  vibeTag?: string;
  date: string;
  attackClass?: number;
}

export default function GamePage() {
  const { user, profile, refreshProfile } = useUser();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userReview, setUserReview] = useState<{ score: number; text: string; id: string; difficultyRating?: number } | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [personalScore, setPersonalScore] = useState(10);
  const [difficultyRating, setDifficultyRating] = useState(10);
  const [ratingError, setRatingError] = useState('');
  const [communityDC, setCommunityDC] = useState<number | '-'>('-');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [showCollectionMenu, setShowCollectionMenu] = useState(false);
  const [addingToShelf, setAddingToShelf] = useState<string | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isTop3ModalOpen, setIsTop3ModalOpen] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState<string>('');
  const [allGameReviews, setAllGameReviews] = useState<any[]>([]);
  const [userFavorites, setUserFavorites] = useState<any[]>([]);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [friendsRating, setFriendsRating] = useState<number | '-'>('-');
  const [isUpdateArtModalOpen, setIsUpdateArtModalOpen] = useState(false);
  const [isErrorReportModalOpen, setIsErrorReportModalOpen] = useState(false);
  const [newArtUrl, setNewArtUrl] = useState('');
  const [isSubmittingArt, setIsSubmittingArt] = useState(false);
  const [showEditionsModal, setShowEditionsModal] = useState(false);
  const [baseGame, setBaseGame] = useState<Game | null>(null);
  const [pendingArtSubmissions, setPendingArtSubmissions] = useState<any[]>([]);
  const [isModerating, setIsModerating] = useState(false);

  // Dynamic Vibe Calculation
  const topVibes = useMemo(() => {
    if (allGameReviews.length === 0) return [];
    
    const counts: Record<string, number> = {};
    let totalWithVibes = 0;
    
    allGameReviews.forEach(review => {
      if (review.vibeTag) {
        counts[review.vibeTag] = (counts[review.vibeTag] || 0) + 1;
        totalWithVibes++;
      }
    });
    
    if (totalWithVibes === 0) return [];
    
    return Object.entries(counts)
      .map(([tag, count]) => ({
        tag,
        percentage: Math.round((count / totalWithVibes) * 100)
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3);
  }, [allGameReviews]);

  // Deterministic Rating Logic (Matches GameCard.tsx)
  const getRatings = () => {
    if (!game) return { personal: '-', friends: '-', community: '-' };
    
    return {
      personal: userReview ? userReview.score : '-',
      friends: friendsRating,
      community: game.rating || '-'
    };
  };

  const ratings = getRatings();

  // Optimistic override for personal rating if user just submitted
  const displayPersonalRating = userReview ? userReview.score : ratings.personal;

  const shelves = [
    { id: 'owned', label: 'Owned', color: 'bg-emerald-500' },
    { id: 'wishlist', label: 'Wishlist', color: 'bg-rose-500' },
  ];

  const addToCollection = async (shelfId: string) => {
    if (!user || !game) {
      alert('Please sign in to add games to your collection!');
      return;
    }

    setAddingToShelf(shelfId);
    const path = `userCollections/${user.uid}_${game.id}`;
    try {
      await setDoc(doc(db, 'userCollections', `${user.uid}_${game.id}`), {
        userId: user.uid,
        gameId: game.id,
        gameTitle: game.title,
        gameCover: game.coverImage,
        shelf: shelfId,
        addedAt: serverTimestamp(),
      });

      // Log Activity (New Unified Logger)
      logActivity({
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        avatarSeed: profile?.avatarSeed || user.uid,
        type: 'game_added',
        metadata: {
          gameId: game.id,
          gameTitle: game.title,
          gameCover: game.coverImage,
          shelf: shelfId
        }
      });

      await refreshProfile();
      setShowCollectionMenu(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setAddingToShelf(null);
    }
  };

  const handleSubmitReview = async () => {
    if (!user || !game) return;

    setIsSubmittingReview(true);
    try {
      const reviewData = {
        gameId: game.id,
        userId: user.uid,
        userName: user.displayName || 'Gamer',
        userAvatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        score: personalScore,
        difficultyRating: difficultyRating,
        text: reviewText.trim(),
        vibeTag: selectedVibe || null,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'reviews'), reviewData);
      
      setUserReview({
        id: docRef.id,
        score: personalScore,
        difficultyRating: difficultyRating,
        text: reviewText
      });

      // Log Activity
      logActivity({
        userId: user.uid,
        userName: user.displayName || 'Gamer',
        avatarSeed: (profile as any)?.avatarSeed || user.uid,
        type: 'review_added',
        metadata: {
          gameId: game.id,
          gameTitle: game.title,
          gameCover: game.coverImage,
          score: personalScore,
          text: reviewText.trim()
        }
      });

      await refreshProfile();
      setReviewText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reviews');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleShare = async () => {
    if (!game) return;
    
    const shareData = {
      title: game.title,
      text: 'Check out this game on CritShelf!',
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link Copied to Clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleFavorite = async () => {
    if (!user || !game) {
      alert('Please sign in to favorite games!');
      return;
    }

    setIsFavoriting(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      const userData = userSnap.exists() ? userSnap.data() : {};
      const currentFavorites = userData.favorites || [];

      // Check if already favorited
      if (currentFavorites.some((f: any) => f.gameId === game.id)) {
        // Remove from favorites
        const updatedFavorites = currentFavorites.filter((f: any) => f.gameId !== game.id);
        await updateDoc(userDocRef, { favorites: updatedFavorites });
        setUserFavorites(updatedFavorites);
        await refreshProfile();
        return;
      }

      if (currentFavorites.length < 3) {
        const newFavorite = {
          gameId: game.id,
          gameTitle: game.title,
          gameCover: game.coverImage,
          rating: displayPersonalRating !== '-' ? displayPersonalRating : ratings.community,
          isPersonal: displayPersonalRating !== '-'
        };
        const updatedFavorites = [...currentFavorites, newFavorite];
        await updateDoc(userDocRef, { favorites: updatedFavorites });
        setUserFavorites(updatedFavorites);
        await refreshProfile();
        alert('Added to Top 3!');
      } else {
        setUserFavorites(currentFavorites);
        setIsTop3ModalOpen(true);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setIsFavoriting(false);
    }
  };

  const swapFavorite = async (oldGameId: string) => {
    if (!user || !game) return;

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const newFavorite = {
        gameId: game.id,
        gameTitle: game.title,
        gameCover: game.coverImage,
        rating: displayPersonalRating !== '-' ? displayPersonalRating : ratings.community,
        isPersonal: displayPersonalRating !== '-'
      };
      const updatedFavorites = userFavorites.map(f => f.gameId === oldGameId ? newFavorite : f);
      
      await updateDoc(userDocRef, { favorites: updatedFavorites });
      setUserFavorites(updatedFavorites);
      await refreshProfile();
      setIsTop3ModalOpen(false);
      alert('Shelf Updated!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleUpdateArt = async (e: any) => {
    e.preventDefault();
    if (!user || !game || !newArtUrl.trim()) return;

    setIsSubmittingArt(true);
    try {
      // 1. Write to PendingArt collection for record keeping
      await addDoc(collection(db, 'PendingArt'), {
        gameId: game.id,
        gameTitle: game.title,
        proposedImageUrl: newArtUrl.trim(),
        submittedBy: user.uid,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // 2. Trigger Discord Admin Webhook (Interactive Moderation)
      fetch('/api/webhooks/art-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          gameTitle: game.title,
          imageUrl: newArtUrl.trim()
        })
      }).catch(err => console.error("Admin notification failed:", err));

      alert('Art submitted for review!');
      setIsUpdateArtModalOpen(false);
      setNewArtUrl('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'PendingArt');
    } finally {
      setIsSubmittingArt(false);
    }
  };

  const approveArt = async (artId: string, url: string) => {
    if (!game || profile?.role !== 'admin') return;
    setIsModerating(true);
    try {
      await updateDoc(doc(db, 'games', game.id), {
        coverImage: url,
        hasHighResArt: true,
        updatedAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'PendingArt', artId), {
        status: 'approved',
        updatedAt: serverTimestamp()
      });
      setPendingArtSubmissions(prev => prev.filter(a => a.id !== artId));
      setGame(prev => prev ? { ...prev, coverImage: url, hasHighResArt: true } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'games');
    } finally {
      setIsModerating(false);
    }
  };

  const rejectArt = async (artId: string) => {
    if (profile?.role !== 'admin') return;
    setIsModerating(true);
    try {
      await updateDoc(doc(db, 'PendingArt', artId), {
        status: 'rejected',
        updatedAt: serverTimestamp()
      });
      setPendingArtSubmissions(prev => prev.filter(a => a.id !== artId));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'PendingArt');
    } finally {
      setIsModerating(false);
    }
  };

  useEffect(() => {
    const fetchGameData = async () => {
      if (!id) return;
      setLoading(true);
      const path = `games/${id}`;
      try {
        const docRef = doc(db, 'games', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const gameData = { id: docSnap.id, ...docSnap.data() } as Game;
          setGame(gameData);
          
          // Admin Art Check
          if (profile?.role === 'admin') {
            const artQ = query(
              collection(db, 'PendingArt'),
              where('gameId', '==', id),
              where('status', '==', 'pending')
            );
            const artSnap = await getDocs(artQ);
            setPendingArtSubmissions(artSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          }
          
          // Fetch ALL reviews for consensus calculation
          const targetGameId = (docSnap.data() as any).baseGameId || id;
          let targetGameDataForDC = docSnap.data();

          if ((docSnap.data() as any).baseGameId) {
            const bSnap = await getDoc(doc(db, 'games', (docSnap.data() as any).baseGameId));
            if (bSnap.exists()) {
              targetGameDataForDC = bSnap.data();
            }
          }

          const allReviewsQ = query(
            collection(db, 'reviews'),
            where('gameId', '==', targetGameId)
          );
          const allReviewsSnap = await getDocs(allReviewsQ);
          const allReviewsData = allReviewsSnap.docs.map(d => d.data());
          setAllGameReviews(allReviewsData);

          // Community DC Calculation
          const baseDC = calculateBaseDC(targetGameDataForDC);
          const difficultyRatings = allReviewsData
            .map(r => r.difficultyRating)
            .filter(r => typeof r === 'number');
          
          if (difficultyRatings.length > 0) {
            setCommunityDC(calculateFinalDC(baseDC, difficultyRatings));
          } else {
            setCommunityDC(baseDC);
          }

          // If it's an expansion, fetch the base game
          if (gameData.baseGameId) {
            const baseRef = doc(db, 'games', gameData.baseGameId);
            const baseSnap = await getDoc(baseRef);
            if (baseSnap.exists()) {
              setBaseGame({ id: baseSnap.id, ...baseSnap.data() } as Game);
            }
          } else {
            setBaseGame(null);
          }
        } else {
          setGame(null);
        }

        // Fetch user's existing review and favorites if logged in
        if (user) {
          // Review fetch...
          const q = query(
            collection(db, 'reviews'),
            where('gameId', '==', id),
            where('userId', '==', user.uid),
            limit(1)
          );
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            const data = doc.data();
            setUserReview({
              id: doc.id,
              score: data.score,
              difficultyRating: data.difficultyRating,
              text: data.text
            });
          }

          // Favorites fetch and Friends Rating
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists()) {
            const userData = userSnap.data();
            setUserFavorites(userData.favorites || []);
            const following = userData.following || [];

            // Friends Rating from the already fetched allReviewsData
            const friendsReviews = allGameReviews.filter(r => following.includes(r.userId));
            if (friendsReviews.length > 0) {
              const total = friendsReviews.reduce((acc, r) => acc + r.score, 0);
              setFriendsRating(Math.round(total / friendsReviews.length));
            } else {
              setFriendsRating('-');
            }
          }
        } else {
          // If not logged in, community DC is already calculated above
        }

        // Fetch community reviews
        const reviewsQ = query(
          collection(db, 'reviews'),
          where('gameId', '==', id),
          limit(10)
        );
        const reviewsSnapshot = await getDocs(reviewsQ);
        const fetchedReviews = reviewsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: 'Recently'
        })) as any[];

        if (fetchedReviews.length > 0) {
          const reviewerIds = Array.from(new Set(fetchedReviews.map(r => r.userId)));
          const usersSnap = await getDocs(query(collection(db, 'users'), where('uid', 'in', reviewerIds)));
          const userMap = usersSnap.docs.reduce((acc, doc) => {
            acc[doc.id] = doc.data().attackClass;
            return acc;
          }, {} as Record<string, number>);
          
          fetchedReviews.forEach(r => {
            r.attackClass = userMap[r.userId];
          });
        }
        
        setReviews(fetchedReviews);

      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      } finally {
        setLoading(false);
      }
    };

    fetchGameData();
  }, [id, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <h1 className="text-3xl font-black text-gray-900 mb-4">Game Not Found</h1>
        <button 
          onClick={() => navigate('/search')}
          className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg"
        >
          Back to Search
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal pb-32 md:pt-24">
      {/* Hero Banner */}
      <div className="relative h-[400px] md:h-[500px] bg-charcoal overflow-hidden">
        {/* Vibe Blur Background */}
        <div className="absolute inset-0">
          <img 
            src={game.bannerImage || game.coverImage} 
            alt="" 
            className={cn(
              "w-full h-full object-cover scale-110 transiton-all duration-700",
              game.hasHighResArt 
                ? "opacity-100 filter-none" 
                : (!game.bannerImage ? "blur-2xl opacity-30" : "opacity-40")
            )}
            style={game.bannerImage ? game.bannerStyles : undefined}
            referrerPolicy="no-referrer"
          />
        </div>
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal via-charcoal/60 to-transparent" />
        
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 bg-white/5 backdrop-blur-md text-white p-3 rounded-2xl hover:bg-white/10 transition-all z-40 border border-white/10"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Update Art Button */}
        <button 
          onClick={() => setIsUpdateArtModalOpen(true)}
          className="absolute top-6 right-6 bg-white/5 backdrop-blur-md text-white/40 px-4 py-2 rounded-xl hover:bg-white/10 transition-all z-40 flex items-center gap-2 text-xs font-black uppercase tracking-widest border border-white/10"
        >
          <ImageIcon className="w-4 h-4" />
          Update Art
        </button>

        <div className="absolute bottom-12 left-6 right-6 max-w-7xl mx-auto z-30">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-emerald-accent font-black uppercase tracking-widest text-sm mb-2">
              {game.publishers?.[0] || game.publisher || 'Independent Publisher'}
            </p>
            <div className="flex items-center gap-4 mb-6">
              <GameTitleWithDC 
                game={game} 
                shieldSize="md" 
                titleClassName="text-5xl md:text-7xl font-black text-white tracking-tight max-w-3xl"
                shouldTruncate={false}
              />
              {game.editions && game.editions.length > 0 && (
                <button
                  onClick={() => setShowEditionsModal(true)}
                  className="bg-white/5 backdrop-blur-md text-emerald-accent px-4 py-2 rounded-xl hover:bg-white/10 transition-all z-40 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border border-emerald-accent/20 h-fit mt-auto mb-2"
                >
                  <Layers className="w-4 h-4" />
                  View Alternate Editions
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => setIsLogModalOpen(true)}
                className="bg-gold-accent text-charcoal px-8 py-4 rounded-2xl font-black shadow-lg hover:shadow-gold-accent/20 transition-all flex items-center gap-3 active:scale-95"
              >
                <Trophy className="w-6 h-6" />
                Log a Play
              </button>
              
              <button 
                onClick={handleFavorite}
                disabled={isFavoriting}
                className={cn(
                  "backdrop-blur-md p-4 rounded-2xl transition-all border border-white/10 active:scale-95",
                  userFavorites.some(f => f.gameId === game.id)
                    ? "bg-emerald-accent text-charcoal border-emerald-accent"
                    : "bg-white/5 text-white hover:bg-white/10"
                )}
              >
                {isFavoriting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Heart className={cn("w-6 h-6", userFavorites.some(f => f.gameId === game.id) && "fill-current")} />
                )}
              </button>
              <button 
                onClick={handleShare}
                className="bg-white/5 backdrop-blur-md text-white p-4 rounded-2xl hover:bg-white/10 transition-all border border-white/10"
              >
                <Share2 className="w-6 h-6" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-8 relative z-10">
        {/* Admin Moderation Queue */}
        {profile?.role === 'admin' && pendingArtSubmissions.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-gold-accent/10 backdrop-blur-xl rounded-[2rem] p-6 border border-gold-accent/30 overflow-hidden"
          >
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-5 h-5 text-gold-accent" />
              <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Game Lab: Art Moderation</h3>
              {isModerating && <Loader2 className="w-4 h-4 text-gold-accent animate-spin" />}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pendingArtSubmissions.map((art) => (
                <div key={art.id} className="bg-charcoal/40 rounded-2xl p-4 border border-white/5 flex flex-col gap-4">
                  <div className="aspect-square rounded-xl overflow-hidden border border-white/10">
                    <img 
                      src={art.proposedImageUrl} 
                      alt="Proposed Art"
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveArt(art.id, art.proposedImageUrl)}
                      disabled={isModerating}
                      className="flex-1 bg-emerald-accent text-charcoal py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectArt(art.id)}
                      disabled={isModerating}
                      className="flex-1 bg-white/5 text-rose-400 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/10 transition-all border border-rose-500/20 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Quick Stats Bar */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-charcoal/80 backdrop-blur-xl rounded-[2rem] shadow-2xl p-6 flex flex-wrap justify-around items-center gap-6 border border-white/10"
        >
          <div className="flex flex-col items-center gap-1">
            <div className="p-3 bg-emerald-accent/10 rounded-2xl text-emerald-accent">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-xs font-black text-white/30 uppercase tracking-widest">Players</span>
            <span className="font-black text-white">{game.playerCount || '2-4'}</span>
          </div>
          <div className="h-12 w-px bg-white/5 hidden sm:block" />
          <div className="flex flex-col items-center gap-1">
            <div className="p-3 bg-gold-accent/10 rounded-2xl text-gold-accent">
              <Clock className="w-6 h-6" />
            </div>
            <span className="text-xs font-black text-white/30 uppercase tracking-widest">Time</span>
            <span className="font-black text-white">{formatPlayTime(game.playTime)}</span>
          </div>
          <div className="h-12 w-px bg-white/5 hidden sm:block" />
          <div className="flex flex-col items-center gap-1">
            <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-500">
              <Calendar className="w-6 h-6" />
            </div>
            <span className="text-xs font-black text-white/30 uppercase tracking-widest">Age</span>
            <span className="font-black text-white">{game.ageRange || '10+'}</span>
          </div>
        </motion.div>

        {/* Ratings Block - 3 Dice System */}
        <div className="mt-12 bg-white/5 rounded-[2.5rem] p-8 shadow-2xl border border-white/10">
          <div className="flex flex-col gap-10">
            <div className="flex flex-wrap items-center justify-around gap-8">
              <div className="flex flex-col items-center gap-3">
                <D20Die value={displayPersonalRating} theme={displayPersonalRating === '-' ? 'outline' : 'gold'} size="lg" />
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Personal</p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <D20Die value={ratings.friends} theme={ratings.friends === '-' ? 'outline' : 'silver'} size="lg" />
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Friends</p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <D20Die value={ratings.community} theme="emerald" size="lg" />
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Community</p>
              </div>
              {game.baseGameId && (
                <div className="flex flex-col items-center gap-1 group relative">
                  <div className="flex items-center gap-2 bg-emerald-accent/10 px-3 py-1.5 rounded-full border border-emerald-accent/20">
                    <Shield className="w-3 h-3 text-emerald-accent" />
                    <span className="text-[9px] font-black text-emerald-accent uppercase tracking-widest">DC Inherited</span>
                  </div>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block w-48 bg-charcoal border border-white/10 p-3 rounded-2xl shadow-2xl z-50">
                    <p className="text-[10px] text-white/60 font-medium leading-relaxed">
                      Expansions do not have independent DC ratings. Difficulty is inherited from <strong>{baseGame?.title || 'the base game'}</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="w-full">
              <VibeSystem vibes={topVibes} />
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <button 
              onClick={() => setIsLogModalOpen(true)}
              className="flex-1 min-w-[200px] bg-emerald-accent text-charcoal px-8 py-4 rounded-2xl font-black shadow-lg hover:shadow-emerald-accent/20 transition-all flex items-center justify-center gap-3 group active:scale-95"
            >
              <Dices className="w-6 h-6 group-hover:rotate-12 transition-transform" />
              Log a Play
            </button>
            <div 
              role="button"
              tabIndex={0}
              onClick={() => setShowCollectionMenu(!showCollectionMenu)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setShowCollectionMenu(!showCollectionMenu);
                }
              }}
              className="bg-white/5 text-white p-4 rounded-2xl font-black hover:bg-white/10 transition-all flex items-center gap-2 relative border border-white/10 cursor-pointer select-none"
            >
              <Plus className="w-6 h-6" />
              <span className="hidden sm:inline">Add to Collection</span>
              
              <AnimatePresence>
                {showCollectionMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-full mb-3 right-0 w-64 bg-charcoal rounded-3xl shadow-2xl p-3 z-50 border border-white/10 cursor-default"
                  >
                    <div className="space-y-1">
                      {shelves.map((shelf) => (
                        <button
                          key={shelf.id}
                          onClick={() => addToCollection(shelf.id)}
                          disabled={addingToShelf === shelf.id}
                          className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all group/item"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("w-3 h-3 rounded-full", shelf.color)} />
                            <span className="font-black text-white/70 text-sm group-hover/item:text-white">{shelf.label}</span>
                          </div>
                          {addingToShelf === shelf.id ? (
                            <div className="w-4 h-4 border-2 border-emerald-accent border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4 text-white/20 group-hover/item:text-emerald-accent transition-colors" />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Smart Data Grid */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-4">
          {game.playerCount && (
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-3">
              <Users className="w-5 h-5 text-emerald-accent" />
              <div>
                <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">Players</p>
                <p className="text-sm font-bold text-white">{game.playerCount}</p>
              </div>
            </div>
          )}
          {game.playTime && (
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-3">
              <Clock className="w-5 h-5 text-gold-accent" />
              <div>
                <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">Time</p>
                <p className="text-sm font-bold text-white">{game.playTime}</p>
              </div>
            </div>
          )}
          {game.publishingYear && (
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-3">
              <Calendar className="w-5 h-5 text-rose-500" />
              <div>
                <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">Year</p>
                <p className="text-sm font-bold text-white">{game.publishingYear}</p>
              </div>
            </div>
          )}
          {game.designers && game.designers.length > 0 && (
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-3 col-span-2 md:col-span-1">
              <Trophy className="w-5 h-5 text-sky-500" />
              <div className="min-w-0">
                <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">Designer</p>
                <p className="text-sm font-bold text-white truncate">
                  {Array.isArray(game.designers) ? game.designers.join(', ') : (game.designers || 'Unknown Designer')}
                </p>
              </div>
            </div>
          )}
          {game.publishers && game.publishers.length > 0 && (
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-3 col-span-2 md:col-span-1">
              <ImageIcon className="w-5 h-5 text-purple-500" />
              <div className="min-w-0">
                <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">Publisher</p>
                <p className="text-sm font-bold text-white truncate">
                  {Array.isArray(game.publishers) ? game.publishers.join(', ') : (game.publishers || 'Unknown Publisher')}
                </p>
              </div>
            </div>
          )}
          {game.categories && game.categories.length > 0 && (
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-3 col-span-2 md:col-span-1">
              <Dices className="w-5 h-5 text-emerald-accent" />
              <div className="min-w-0">
                <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">Categories</p>
                <p className="text-sm font-bold text-white truncate">
                  {Array.isArray(game.categories) ? game.categories.join(', ') : (game.categories || 'Uncategorized')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="mt-16">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-2 tracking-tight">
              About
            </h2>
            <div className="h-px w-full bg-emerald-accent/20" />
          </div>
          <div className="bg-white/5 rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-white/10 leading-relaxed text-white/70 font-medium text-lg">
            {game.description || 'No description available for this game yet. Stay tuned for updates!'}
          </div>
        </div>

        {/* Expansions Section */}
        {game.expansions && game.expansions.length > 0 && (
          <div className="mt-12">
            <div className="mb-6">
              <h2 className="text-xl font-black text-white/40 uppercase tracking-widest flex items-center gap-3">
                <Plus className="w-5 h-5 text-emerald-accent" />
                Expansions
              </h2>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 scrollbar-none snap-x">
              {game.expansions.map((expansion) => (
                <motion.div
                  key={expansion.id}
                  whileHover={{ y: -4 }}
                  onClick={() => navigate(`/game/${expansion.id}`)}
                  className="w-32 shrink-0 snap-start group cursor-pointer"
                >
                  <div className="aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 mb-3 relative">
                    <img 
                      src={expansion.boxArtUrl} 
                      alt={expansion.title} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h4 className="text-[10px] font-black text-white leading-tight line-clamp-2 uppercase tracking-tight group-hover:text-emerald-accent transition-colors">
                    {expansion.title}
                  </h4>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black text-white flex items-center gap-2 tracking-tight">
              <MessageCircle className="w-6 h-6 text-emerald-accent" />
              Your Review
            </h2>
          </div>

          {userReview ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl"
            >
              <div className="flex items-start gap-6">
                <D20Die value={userReview.score} theme="gold" size="md" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-white text-lg">Your Rating</span>
                    <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Submitted</span>
                  </div>
                  <p className="text-white/70 text-lg leading-relaxed italic">"{userReview.text}"</p>
                </div>
              </div>
            </motion.div>
          ) : game.baseGameId ? (
            <div className="bg-white/5 rounded-[2.5rem] p-12 border border-white/10 shadow-2xl text-center">
              <div className="w-16 h-16 bg-emerald-accent/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-emerald-accent/20">
                <Shield className="w-8 h-8 text-emerald-accent" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Difficulty Voting Disabled</h3>
              <p className="text-white/40 font-medium max-w-sm mx-auto">
                Difficulty ratings for expansions are tied to the parent game. 
                Visit the <button onClick={() => navigate(`/game/${game.baseGameId}`)} className="text-emerald-accent hover:underline">Base Game</button> to contribute to the community DC.
              </p>
              
              <div className="mt-10 pt-10 border-t border-white/5 space-y-4">
                <label className="text-xs font-black text-white/20 uppercase tracking-widest ml-2 block text-left">Your General Thoughts</label>
                <textarea 
                  placeholder="Review the expansion's content, balance, and quality..."
                  className="w-full bg-charcoal border border-white/10 rounded-[2rem] p-6 text-white placeholder:text-white/10 outline-none focus:border-gold-accent transition-all resize-none h-40 font-medium"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                />
                <button 
                  disabled={isSubmittingReview}
                  onClick={handleSubmitReview}
                  className="w-full bg-gold-accent text-charcoal py-5 rounded-2xl font-black text-lg shadow-lg hover:shadow-gold-accent/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
                >
                  {isSubmittingReview ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Post Review
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
              <div className="mb-10">
                <div className="flex items-center justify-between mb-6 px-2">
                  <label className="text-xs font-black text-white/20 uppercase tracking-widest block">Select Your D20 Score</label>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black text-gold-accent tracking-tighter">{personalScore}</span>
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">/ 20</span>
                  </div>
                </div>
                
                <div className="relative px-2">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={personalScore}
                    onChange={(e) => setPersonalScore(parseInt(e.target.value))}
                    className="w-full h-2 bg-charcoal rounded-lg appearance-none cursor-pointer accent-gold-accent"
                    style={{
                      background: `linear-gradient(to right, var(--color-gold-accent) 0%, var(--color-gold-accent) ${(personalScore - 1) / 19 * 100}%, #1a1a1a ${(personalScore - 1) / 19 * 100}%, #1a1a1a 100%)`
                    }}
                  />
                  <style>{`
                    input[type='range']::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      appearance: none;
                      width: 24px;
                      height: 24px;
                      background: var(--color-gold-accent);
                      cursor: pointer;
                      border-radius: 50%;
                      border: 4px solid #141414;
                      box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);
                      transition: all 0.2s ease;
                    }
                    input[type='range']::-webkit-slider-thumb:hover {
                      transform: scale(1.1);
                      box-shadow: 0 0 20px rgba(212, 175, 55, 0.5);
                    }
                    input[type='range']::-moz-range-thumb {
                      width: 24px;
                      height: 24px;
                      background: var(--color-gold-accent);
                      cursor: pointer;
                      border-radius: 50%;
                      border: 4px solid #141414;
                      box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);
                    }
                  `}</style>
                </div>
                
                <div className="flex justify-between mt-4 px-2">
                  <span className="text-[10px] font-black text-white/10 uppercase tracking-widest">Critical Fail</span>
                  <span className="text-[10px] font-black text-white/10 uppercase tracking-widest">Nat 20</span>
                </div>
              </div>

              {/* DC Shield Input */}
              <div className="mb-10 flex flex-col items-center">
                <label className="text-xs font-black text-white/20 uppercase tracking-widest mb-6 block text-center">Set the DC (Difficulty Class)</label>
                
                <div className="relative w-24 h-24 flex items-center justify-center group">
                  {/* Polished Metallic Shield SVG */}
                  <svg 
                    viewBox="0 0 100 100" 
                    className="absolute inset-0 w-full h-full drop-shadow-2xl transition-transform group-hover:scale-105 duration-300"
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <linearGradient id="shieldInputGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#cbd5e1" />
                        <stop offset="50%" stopColor="#64748b" />
                        <stop offset="100%" stopColor="#1e293b" />
                      </linearGradient>
                      <linearGradient id="innerInputGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#94a3b8" />
                        <stop offset="100%" stopColor="#334155" />
                      </linearGradient>
                    </defs>
                    
                    {/* Outer Border/Rim */}
                    <path 
                      d="M 50 92 C 50 92 83 75 83 50 V 21 L 50 8 L 17 21 V 50 C 17 75 50 92 50 92 Z" 
                      fill="url(#shieldInputGradient)" 
                      stroke="#0f172a" 
                      strokeWidth="3"
                      strokeLinejoin="round"
                    />
                    
                    {/* Inner Shield Face */}
                    <path 
                      d="M 50 86 C 50 86 77 71 77 50 V 26 L 50 15 L 23 26 V 50 C 23 71 50 86 50 86 Z" 
                      fill="url(#innerInputGradient)" 
                      stroke="rgba(255,255,255,0.1)" 
                      strokeWidth="1"
                      strokeLinejoin="round"
                    />
                  </svg>
                  
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={difficultyRating === 0 ? '' : difficultyRating}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setDifficultyRating(0);
                        setRatingError('');
                        return;
                      }
                      const num = parseInt(val);
                      setDifficultyRating(num);
                      
                      if (num > 20) {
                        setRatingError('Critical failure! Max rating is 20.');
                      } else {
                        setRatingError('');
                      }
                    }}
                    onBlur={() => {
                      if (difficultyRating < 1) {
                        setDifficultyRating(1);
                        setRatingError('');
                      }
                    }}
                    className={cn(
                      "relative z-10 w-full h-full bg-transparent border-none text-center font-black text-white text-3xl outline-none pt-2",
                      "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    )}
                  />
                </div>
                {ratingError && (
                  <p className="text-red-500 text-xs mt-3 font-semibold text-center animate-pulse">
                    {ratingError}
                  </p>
                )}
                
                <div className="flex justify-between w-full mt-4 px-8">
                  <span className="text-[10px] font-black text-white/10 uppercase tracking-widest">Very Easy</span>
                  <span className="text-[10px] font-black text-white/10 uppercase tracking-widest">Insane</span>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="text-xs font-black text-white/20 uppercase tracking-widest ml-2 block">The Vibe Check</label>
                  <div className="flex flex-wrap gap-2">
                    {VIBE_OPTIONS.map((vibe) => (
                      <button
                        key={vibe}
                        onClick={() => setSelectedVibe(vibe === selectedVibe ? '' : vibe)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                          selectedVibe === vibe 
                            ? "bg-gold-accent text-charcoal border-gold-accent shadow-lg shadow-gold-accent/20" 
                            : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"
                        )}
                      >
                        {vibe}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black text-white/20 uppercase tracking-widest ml-2 block">Your Thoughts</label>
                  <textarea 
                    placeholder="What did you think of the gameplay, theme, and components?"
                    className="w-full bg-charcoal border border-white/10 rounded-[2rem] p-6 text-white placeholder:text-white/10 outline-none focus:border-gold-accent transition-all resize-none h-40 font-medium"
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                  />
                  <button 
                    disabled={isSubmittingReview || !!ratingError}
                    onClick={handleSubmitReview}
                    className="w-full bg-gold-accent text-charcoal py-5 rounded-2xl font-black text-lg shadow-lg hover:shadow-gold-accent/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
                  >
                    {isSubmittingReview ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        {reviewText.trim() ? 'Post Review' : 'Submit Rating'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Community Reviews List */}
          {reviews.length > 0 && (
            <div className="mt-16">
              <h3 className="text-xl font-black text-white/40 uppercase tracking-widest mb-8 ml-2">Community Feedback</h3>
              <div className="space-y-4">
                {reviews.filter(r => r.userId !== user?.uid).map((review) => (
                  <motion.div 
                    key={review.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white/5 p-6 rounded-[2rem] shadow-md border border-white/10 flex gap-4"
                  >
                    <UserAvatar 
                      user={{ 
                        photoURL: review.userAvatar, 
                        avatarPreference: review.avatarPreference, 
                        avatarSeed: review.avatarSeed,
                        uid: review.userId,
                        displayName: review.userName 
                      }} 
                      size="md" 
                      className="rounded-xl border border-white/10" 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-black text-white truncate">{review.userName}</span>
                          <ACBadge value={(review as any).attackClass} size="sm" />
                        </div>
                        <div className="flex items-center gap-2">
                          {review.vibeTag && (
                            <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/40 font-bold uppercase tracking-widest leading-none">
                              {review.vibeTag.split(' ')[0]} {review.vibeTag.split(' ').slice(1).join(' ')}
                            </span>
                          )}
                          <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">{review.date}</span>
                          <span className="font-black text-gold-accent text-sm">{review.score}/20</span>
                        </div>
                      </div>
                      <p className="text-white/60 text-sm leading-relaxed line-clamp-3">{review.text}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Legal Attribution */}
        <div className="mt-20 pb-12 text-center flex flex-col items-center gap-6">
          <p className="text-[10px] font-black text-white/5 uppercase tracking-[0.2em]">
            Description text provided by Wikipedia (CC BY-SA 3.0).
          </p>
          <button 
            onClick={() => setIsErrorReportModalOpen(true)}
            className="flex items-center gap-2 text-white/20 hover:text-gold-accent transition-colors py-2 px-4 bg-white/5 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest"
          >
            <Flag className="w-3 h-3" />
            Report an Error
          </button>
        </div>
      </div>

      <LogPlayModal 
        isOpen={isLogModalOpen} 
        onClose={() => setIsLogModalOpen(false)} 
        initialGameId={game.id}
      />

      <ReportErrorModal 
        isOpen={isErrorReportModalOpen}
        onClose={() => setIsErrorReportModalOpen(false)}
        gameId={game.id}
        gameTitle={game.title}
      />

      {/* Editions Modal */}
      <AnimatePresence>
        {showEditionsModal && game.editions && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditionsModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-charcoal rounded-[3rem] shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[80vh]"
            >
              <div className="bg-white/5 p-8 text-white relative border-b border-white/10 shrink-0">
                <button 
                  onClick={() => setShowEditionsModal(false)}
                  className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors p-2 bg-white/5 rounded-xl border border-white/10 z-10"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-accent/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-emerald-accent/20">
                    <Layers className="w-6 h-6 text-emerald-accent" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">Alternate Editions</h2>
                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Different versions of {game.title}</p>
                  </div>
                </div>
              </div>

              <div className="p-8 overflow-y-auto space-y-4">
                {game.editions.map((edition) => (
                  <div 
                    key={edition.id}
                    className="flex gap-6 bg-white/5 p-4 rounded-2xl border border-white/10 hover:border-emerald-accent/30 transition-all group"
                  >
                    <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden border border-white/10 bg-black/20">
                      <img 
                        src={edition.boxArtUrl} 
                        alt={edition.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h4 className="font-black text-white text-lg leading-tight mb-2 truncate group-hover:text-emerald-accent transition-colors">
                        {edition.title}
                      </h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="w-3 h-3 text-white/20" />
                          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest truncate max-w-[150px]">
                            {edition.publisher}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-white/20" />
                          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                            {edition.yearPublished}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-8 bg-black/20 border-t border-white/10 shrink-0">
                <button
                  onClick={() => setShowEditionsModal(false)}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all"
                >
                  Close Library
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Top 3 Shelf Full Modal */}
      <AnimatePresence>
        {isTop3ModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTop3ModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-lg bg-charcoal rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl overflow-hidden border-t sm:border border-white/10 p-8"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-accent/20">
                  <Trophy className="w-8 h-8 text-emerald-accent" />
                </div>
                <h2 className="text-3xl font-black text-white tracking-tight">Your Shelf is Full!</h2>
                <p className="text-white/40 font-bold mt-2">Which game are you bumping off the shelf?</p>
              </div>

              <div className="space-y-3">
                {userFavorites.map((fav) => (
                  <button
                    key={fav.gameId}
                    onClick={() => swapFavorite(fav.gameId)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-emerald-accent/30 transition-all group text-left"
                  >
                    <img 
                      src={fav.gameCover} 
                      alt={fav.gameTitle} 
                      className="w-16 h-16 rounded-xl object-cover border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-white truncate">{fav.gameTitle}</h4>
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Current Favorite</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-emerald-accent group-hover:text-charcoal transition-colors">
                      <Plus className="w-5 h-5 rotate-45 group-hover:rotate-0 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsTop3ModalOpen(false)}
                className="w-full mt-8 py-4 text-white/40 font-black uppercase tracking-widest text-xs hover:text-white transition-colors"
              >
                Nevermind, keep my shelf as is
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Update Art Modal */}
      <AnimatePresence>
        {isUpdateArtModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUpdateArtModalOpen(false)}
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
                  onClick={() => setIsUpdateArtModalOpen(false)}
                  className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors p-2 bg-white/5 rounded-xl border border-white/10 z-10"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="relative flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-accent/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-emerald-accent/20">
                    <ImageIcon className="w-6 h-6 text-emerald-accent" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">Update Box Art</h2>
                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Help us improve the library</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleUpdateArt} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-white/20 uppercase tracking-widest ml-2">New Image URL</label>
                  <input
                    required
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-emerald-accent outline-none transition-all font-bold text-white placeholder:text-white/10"
                    value={newArtUrl}
                    onChange={e => setNewArtUrl(e.target.value)}
                  />
                  <p className="text-[10px] font-bold text-emerald-accent/60 ml-2 italic">
                    Note: Art submissions are reviewed by moderators before going live.
                  </p>
                </div>

                <button
                  disabled={isSubmittingArt || !newArtUrl.trim()}
                  type="submit"
                  className="w-full bg-emerald-accent text-charcoal py-5 rounded-2xl font-black text-lg shadow-lg hover:shadow-emerald-accent/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
                >
                  {isSubmittingArt ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Submit for Review
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
