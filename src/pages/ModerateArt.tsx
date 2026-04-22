import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, updateDoc, collection, query, where, getDocs, serverTimestamp, getDoc } from 'firebase/firestore';
import { useUser } from '../contexts/UserContext';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { sendNotification } from '../services/notificationService';

export default function ModerateArt() {
  const [searchParams] = useSearchParams();
  const { profile } = useUser();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'unauthorized'>('loading');
  const [message, setMessage] = useState('');

  const gameId = searchParams.get('gameId');
  const action = searchParams.get('action');
  const adminToken = searchParams.get('adminToken');
  const imageUrl = searchParams.get('imageUrl');

  useEffect(() => {
    const handleModeration = async () => {
      // 1. Basic Validation
      if (!gameId || !action || !adminToken) {
        setStatus('error');
        setMessage('Missing required parameters.');
        return;
      }

      // 2. Token Check
      if (adminToken !== import.meta.env.VITE_ADMIN_SECRET_TOKEN) {
        setStatus('unauthorized');
        setMessage('Invalid Admin Token.');
        return;
      }

      // 3. Admin Check
      if (!profile || profile.role !== 'admin') {
        setStatus('unauthorized');
        setMessage('You must be an admin to perform this action. Please log in with an admin account.');
        return;
      }

      try {
        const gameSnap = await getDoc(doc(db, 'games', gameId));
        const gameData = gameSnap.data();

        if (action === 'approve') {
          // 1. Update game document
          await updateDoc(doc(db, 'games', gameId), {
            coverImage: imageUrl,
            hasHighResArt: true,
            updatedAt: serverTimestamp()
          });

          // 2. Mark pending art as approved and notify user
          const pendingQuery = query(
            collection(db, 'PendingArt'),
            where('gameId', '==', gameId),
            where('status', '==', 'pending')
          );
          const pendingSnap = await getDocs(pendingQuery);
          
          for (const d of pendingSnap.docs) {
            const data = d.data();
            await updateDoc(doc(db, 'PendingArt', d.id), {
              status: 'approved',
              updatedAt: serverTimestamp()
            });

            // Notify submitter
            if (data.submittedBy) {
              await sendNotification(
                data.submittedBy,
                'moderation',
                'Art Approved! 🎨',
                `Your high-res art submission for "${gameData?.title || gameId}" has been approved.`,
                `/game/${gameId}`
              );
            }
          }

          setStatus('success');
          setMessage(`Game ${gameId} has been successfully updated with new art.`);
        } else if (action === 'reject') {
          // Mark pending art as rejected
          const pendingQuery = query(
            collection(db, 'PendingArt'),
            where('gameId', '==', gameId),
            where('status', '==', 'pending')
          );
          const pendingSnap = await getDocs(pendingQuery);
          
          for (const d of pendingSnap.docs) {
            const data = d.data();
            await updateDoc(doc(db, 'PendingArt', d.id), {
              status: 'rejected',
              updatedAt: serverTimestamp()
            });

            // Notify submitter
            if (data.submittedBy) {
              await sendNotification(
                data.submittedBy,
                'moderation',
                'Art Rejected',
                `Your art submission for "${gameData?.title || gameId}" was not accepted at this time.`,
                `/game/${gameId}`
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

    if (profile !== undefined) { // Wait for profile to load
      handleModeration();
    }
  }, [gameId, action, adminToken, imageUrl, profile]);

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center p-6 pt-24 text-white">
      <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-[3rem] p-12 text-center shadow-2xl backdrop-blur-xl">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-emerald-accent animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-black mb-2">Processing Action</h1>
            <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Communicating with CritShelf Library...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 bg-emerald-accent/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-emerald-accent/30">
              <CheckCircle2 className="w-10 h-10 text-emerald-accent" />
            </div>
            <h1 className="text-3xl font-black mb-4">Action Confirmed</h1>
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
