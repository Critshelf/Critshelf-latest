import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp, getDoc } from 'firebase/firestore';
import { useUser } from '../contexts/UserContext';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { sendNotification } from '../services/notificationService';

export default function ModerateArt() {
  const [searchParams] = useSearchParams();
  const { profile, loading: userLoading } = useUser();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'unauthorized'>('loading');
  const [message, setMessage] = useState('');
  const [game, setGame] = useState<any>(null);
  const [isFetching, setIsFetching] = useState(true);

  const gameId = searchParams.get('gameId');
  const action = searchParams.get('action');
  const adminToken = searchParams.get('adminToken');
  const imageUrl = searchParams.get('imageUrl');

  useEffect(() => {
    const handleModeration = async () => {
      if (userLoading) return; // Wait for auth
      
      // 1. Basic Validation
      if (!gameId || !action || !adminToken) {
        setStatus('error');
        setMessage('Missing required parameters.');
        setIsFetching(false);
        return;
      }

      // 2. Token Check
      if (adminToken !== import.meta.env.VITE_ADMIN_SECRET_TOKEN) {
        setStatus('unauthorized');
        setMessage('Invalid Admin Token.');
        setIsFetching(false);
        return;
      }

      // 3. Admin Check
      if (!profile || profile.role !== 'admin') {
        setStatus('unauthorized');
        setMessage('You must be an admin to perform this action. Please log in with an admin account.');
        setIsFetching(false);
        return;
      }

      try {
        const gameRef = doc(db, 'games', gameId);
        const gameSnap = await getDoc(gameRef);
        
        if (!gameSnap.exists()) {
          setStatus('error');
          setMessage('Game not found.');
          setIsFetching(false);
          return;
        }
        
        const gameData = gameSnap.data();
        setGame(gameData);
        setIsFetching(false);

        if (action === 'approve') {
          let finalUrl = imageUrl;

          // 1. Update game document
          await updateDoc(gameRef, {
            coverImage: finalUrl,
            hasHighResArt: true,
            customImageApproved: true,
            updatedAt: serverTimestamp()
          });

          // 2. Mark pending art as approved and notify user
          const pendingQuery = query(
            collection(db, 'art_approvals'),
            where('gameId', '==', gameId),
            where('status', '==', 'pending')
          );
          const pendingSnap = await getDocs(pendingQuery);
          
          for (const d of pendingSnap.docs) {
            const data = d.data();
            await deleteDoc(doc(db, 'art_approvals', d.id));

            // Notify submitter
            if (data.submittedBy) {
              await sendNotification(
                data.submittedBy,
                'moderation',
                'Art Approved! 🎨',
                `Your high-res art submission for "${gameData?.title || gameId}" has been approved.`,
                {
                  gameId: gameId,
                  actionUrl: `/game/${gameId}`
                }
              );
            }
          }

          setStatus('success');
          setMessage(`Game ${gameId} has been successfully updated with new art.`);
        } else if (action === 'reject') {
          // Mark pending art as rejected
          const pendingQuery = query(
            collection(db, 'art_approvals'),
            where('gameId', '==', gameId),
            where('status', '==', 'pending')
          );
          const pendingSnap = await getDocs(pendingQuery);
          
          for (const d of pendingSnap.docs) {
            const data = d.data();
            await deleteDoc(doc(db, 'art_approvals', d.id));

            // Notify submitter
            if (data.submittedBy) {
              await sendNotification(
                data.submittedBy,
                'moderation',
                'Art Rejected',
                `Your art submission for "${gameData?.title || gameId}" was not accepted at this time.`,
                {
                  gameId: gameId,
                  actionUrl: `/game/${gameId}`
                }
              );
            }
          }

          setStatus('success');
          setMessage(`Art submission for game ${gameId} has been rejected.`);
        }
      } catch (error) {
        console.error("Moderation error:", error);
        setStatus('error');
        setMessage('Failed to update database. Check your permissions.');
        handleFirestoreError(error, OperationType.UPDATE, 'games');
      }
    };

    handleModeration();
  }, [gameId, action, adminToken, imageUrl, profile, userLoading]);

  if (userLoading || (isFetching && status === 'loading')) {
    return (
      <div className="min-h-screen bg-charcoal flex flex-col items-center justify-center p-6 text-white">
        <Loader2 className="w-16 h-16 text-emerald-accent animate-spin mb-6" />
        <p className="text-xl font-bold">Loading game data...</p>
      </div>
    );
  }

  if (!game && status === 'error' && message === 'Game not found.') {
    return (
      <div className="min-h-screen bg-charcoal flex flex-col items-center justify-center p-6 text-white">
        <XCircle className="w-16 h-16 text-red-500 mb-6" />
        <p className="text-xl font-bold">Game not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center p-6 pt-24 text-white">
      <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-[3rem] p-12 text-center shadow-2xl backdrop-blur-xl">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-emerald-accent animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-black mb-2">Processing Action</h1>
            {game && <p className="text-white/60 mb-2">Approving: {game.title}</p>}
            <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Communicating with CritShelf Library...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 bg-emerald-accent/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-emerald-accent/30">
              <CheckCircle2 className="w-10 h-10 text-emerald-accent" />
            </div>
            <h1 className="text-3xl font-black mb-4">Action Confirmed</h1>
            {game && <p className="text-emerald-accent font-bold mb-4">{game.title}</p>}
            <p className="text-white/60 mb-8 font-medium leading-relaxed">{message}</p>
            <button 
              onClick={() => window.close()}
              className="px-8 py-4 bg-emerald-accent text-charcoal font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-accent/20"
            >
              Close Window
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-20 h-20 bg-red-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-500/30">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-3xl font-black mb-4">Action Failed</h1>
            <p className="text-white/60 mb-8 font-medium leading-relaxed">{message}</p>
          </>
        )}

        {status === 'unauthorized' && (
          <>
            <div className="w-20 h-20 bg-amber-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-amber-500/30">
              <XCircle className="w-10 h-10 text-amber-500" />
            </div>
            <h1 className="text-3xl font-black mb-4">Access Denied</h1>
            <p className="text-white/60 mb-8 font-medium leading-relaxed">{message}</p>
            <a 
              href="/auth"
              className="inline-block px-8 py-4 bg-white/10 text-white font-black rounded-2xl hover:bg-white/20 transition-all"
            >
              Return to Login
            </a>
          </>
        )}
      </div>
    </div>
  );
}
