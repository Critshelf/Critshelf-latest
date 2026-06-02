import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function ArtApprovalPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, loading: userLoading } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [approvalData, setApprovalData] = useState<any>(null);
  const [gameData, setGameData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function fetchApprovalData() {
      if (!id || userLoading) return;

      if (!profile || profile.role !== 'admin') {
        setIsLoading(false);
        return;
      }

      try {
        const docRef = doc(db, 'art_approvals', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setApprovalData({ id: docSnap.id, ...data });

          if (data.gameId) {
            const gameSnap = await getDoc(doc(db, 'games', data.gameId));
            if (gameSnap.exists()) {
              setGameData(gameSnap.data());
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch approval data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchApprovalData();
  }, [id, profile, userLoading]);

  const handleApprove = async () => {
    if (!approvalData || !id || !gameData) return;
    setIsProcessing(true);

    try {
      const finalUrl = approvalData.proposedUrl;

      const gameRef = doc(db, 'games', approvalData.gameId);
      
      await updateDoc(gameRef, {
        coverImage: finalUrl,
        thumbnail: finalUrl,
        hasHighResArt: true,
        customImageApproved: true,
        isApproved: true,
        updatedAt: serverTimestamp()
      });

      // Update the request status by deleting the document
      await deleteDoc(doc(db, 'art_approvals', id));

      alert('Art Approved Successfully!');
      navigate(`/game/${approvalData.gameId}`);
    } catch (err) {
      console.error(err);
      alert('Failed to approve art.');
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!id || !approvalData) return;
    setIsProcessing(true);
    try {
      // Just delete the request from queue
      await deleteDoc(doc(db, 'art_approvals', id));
      alert('Request rejected and deleted.');
      navigate('/admin-cms');
    } catch (err) {
      console.error(err);
      alert('Failed to reject art.');
      setIsProcessing(false);
    }
  };

  if (userLoading || isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-accent mb-4" />
        <p className="text-white/60 font-bold uppercase tracking-widest text-sm">Loading approval data...</p>
      </div>
    );
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
        <XCircle className="w-16 h-16 text-rose-500" />
        <h2 className="text-2xl font-black">Access Denied</h2>
        <p className="text-white/60">You must be an admin to review art requests.</p>
      </div>
    );
  }

  if (!approvalData || approvalData.status !== 'pending') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
        <p className="text-white/60 text-xl font-medium">This request has already been processed or does not exist.</p>
        <button 
          onClick={() => navigate('/admin-cms')}
          className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors font-bold"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-12">
      <div className="bg-white/5 border border-white/10 rounded-[3rem] p-8 md:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-accent/5 rounded-full -mr-32 -mt-32 pointer-events-none" />
        
        <div className="flex flex-col gap-8 relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-black mb-2 tracking-tight">Review Art Proposal</h1>
            <p className="text-emerald-accent font-bold tracking-widest uppercase text-xs">
              {approvalData.gameTitle}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 md:gap-16 items-center">
            {/* Current Art */}
            <div className="flex flex-col items-center space-y-4">
              <span className="text-white/40 uppercase tracking-widest text-xs font-black">Current Box Art</span>
              <div className="w-48 h-64 bg-black/40 rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center shadow-lg">
                {gameData?.coverImage ? (
                  <img 
                    src={gameData.coverImage} 
                    alt="Current" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-white/20 font-bold">No Image</span>
                )}
              </div>
            </div>

            {/* Proposed Art */}
            <div className="flex flex-col items-center space-y-4">
              <span className="text-emerald-accent uppercase tracking-widest text-xs font-black flex items-center gap-2">
                Proposed Box Art
              </span>
              <div className="w-48 h-64 bg-black/40 rounded-2xl border-4 border-emerald-accent/50 overflow-hidden flex items-center justify-center shadow-2xl shadow-emerald-accent/20">
                <img 
                  src={approvalData.proposedUrl} 
                  alt="Proposed" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <button
              onClick={handleReject}
              disabled={isProcessing}
              className="px-8 py-4 bg-white/5 hover:bg-rose-500/20 text-rose-500 hover:text-rose-400 border border-white/10 hover:border-rose-500/50 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-2 justify-center disabled:opacity-50"
            >
              <XCircle className="w-5 h-5" />
              Reject & Delete
            </button>
            
            <button
              onClick={handleApprove}
              disabled={isProcessing}
              className="px-8 py-4 bg-emerald-accent text-charcoal hover:shadow-lg hover:shadow-emerald-accent/20 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-2 justify-center disabled:opacity-50"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              {isProcessing ? 'Processing Cloudinary Upload...' : 'Approve & Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
