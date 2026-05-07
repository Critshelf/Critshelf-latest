import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, updateDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useUser } from '../contexts/UserContext';
import { CheckCircle2, XCircle, Loader2, Dices } from 'lucide-react';
import { sendNotification } from '../services/notificationService';

export default function ModerateGame() {
  const [searchParams] = useSearchParams();
  const { profile } = useUser();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'unauthorized'>('loading');
  const [message, setMessage] = useState('');
  const [gameTitle, setGameTitle] = useState('');

  const gameId = searchParams.get('gameId');
  const action = searchParams.get('action');
  const adminToken = searchParams.get('adminToken');

  useEffect(() => {
    const handleModeration = async () => {
      if (!gameId || !action || !adminToken) {
        setStatus('error');
        setMessage('Missing required parameters.');
        return;
      }

      // 1. Token Check
      if (adminToken !== import.meta.env.VITE_ADMIN_SECRET_TOKEN) {
        setStatus('unauthorized');
        setMessage('Invalid Admin Token.');
        return;
      }

      // 2. Admin Check
      if (!profile || profile.role !== 'admin') {
        setStatus('unauthorized');
        setMessage('You must be an admin to perform this action.');
        return;
      }

      try {
        const gameRef = doc(db, 'games', gameId);
        const gameSnap = await getDoc(gameRef);
        
        if (!gameSnap.exists()) {
          setStatus('error');
          setMessage('Game not found or already moderated.');
          return;
        }

        const data = gameSnap.data() as any;
        setGameTitle(data.title || gameId);

        if (action === 'approve') {
          await updateDoc(gameRef, {
            isApproved: true,
            status: 'published',
            updatedAt: serverTimestamp()
          });

          // Notify importer
          if (data.importedBy && data.importedBy !== 'user_manual') {
            await sendNotification(
              data.importedBy,
              'moderation',
              'Game Approved! 🎲',
              `Your import request for "${data.title}" has been approved. It's now live!`,
              {
                gameId: gameId,
                actionUrl: `/game/${gameId}`
              }
            );
          }

          setStatus('success');
          setMessage(`"${data.title}" has been approved and is now visible to everyone.`);
        } else if (action === 'reject') {
          // Notify importer before deletion
          if (data.importedBy && data.importedBy !== 'user_manual') {
            await sendNotification(
              data.importedBy,
              'moderation',
              'Import Rejected',
              `Your import request for "${data.title}" was not accepted at this time.`,
              {
                actionUrl: '/browse'
              }
            );
          }

          await deleteDoc(gameRef);
          setStatus('success');
          setMessage(`"${data.title}" has been rejected and removed from the global database.`);
        }
      } catch (error) {
        console.error("Game moderation error:", error);
        setStatus('error');
        setMessage('Failed to moderate game. Check your credentials.');
        handleFirestoreError(error, OperationType.UPDATE, 'games');
      }
    };

    if (profile !== undefined) {
      handleModeration();
    }
  }, [gameId, action, adminToken, profile]);

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center p-6 pt-24 text-white">
      <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-[3rem] p-12 text-center shadow-2xl backdrop-blur-xl">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-emerald-accent animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-black mb-2">Moderating Game</h1>
            <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Awaiting Global Distribution...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 bg-emerald-accent/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-emerald-accent/30">
              <CheckCircle2 className="w-10 h-10 text-emerald-accent" />
            </div>
            <h1 className="text-3xl font-black mb-4">Moderation Complete</h1>
            <p className="text-white/60 mb-8 font-medium leading-relaxed">{message}</p>
            <button 
              onClick={() => window.close()}
              className="px-8 py-4 bg-emerald-accent text-charcoal font-black rounded-2xl hover:scale-105 active:scale-95 transition-all"
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
            <h1 className="text-3xl font-black mb-4">Moderate Failed</h1>
            <p className="text-white/60 mb-8 font-medium leading-relaxed">{message}</p>
          </>
        )}

        {status === 'unauthorized' && (
          <>
            <div className="w-20 h-20 bg-amber-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-amber-500/30">
              <Dices className="w-10 h-10 text-amber-500" />
            </div>
            <h1 className="text-3xl font-black mb-4">Access Denied</h1>
            <p className="text-white/60 mb-8 font-medium leading-relaxed">{message}</p>
            <a 
              href="/auth"
              className="inline-block px-8 py-4 bg-white/10 text-white font-black rounded-2xl hover:bg-white/20 transition-all"
            >
              Go to Login
            </a>
          </>
        )}
      </div>
    </div>
  );
}
