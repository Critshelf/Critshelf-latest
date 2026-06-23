import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, writeBatch, deleteDoc, getDocs, increment } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useUser } from "../contexts/UserContext";
import { UserCheck, Check, X, Loader2 } from "lucide-react";
import { calculateAndStoreAttackClass } from "../services/playLogService";
import { Link } from "react-router-dom";

interface ClaimApproval {
  id: string;
  sessionId: string;
  gameId: string;
  guestIndex: number;
  guestName: string;
  claimedByUserId: string;
  loggerId: string;
  status: string;
  createdAt: any;
}

export default function ClaimApprovals() {
  const { user } = useUser();
  const [claims, setClaims] = useState<ClaimApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, "claim_approvals"),
      where("loggerId", "==", user.uid),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data({ serverTimestamps: 'estimate' })
      })) as ClaimApproval[];
      setClaims(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching claims:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const handleApprove = async (claim: ClaimApproval) => {
    if (!user) return;
    setProcessingId(claim.id);
    
    try {
      // 1. Update play session
      const playRef = doc(db, "plays", claim.sessionId);
      const playSnap = await getDoc(playRef);
      
      if (playSnap.exists()) {
        const playData = playSnap.data();
        let updatedPlayers = [...(playData.players || [])];
        let claimedPlayerFound = false;

        if (claim.guestIndex !== undefined && updatedPlayers[claim.guestIndex]) {
           // Ensure it matches and is currently a guest
           updatedPlayers[claim.guestIndex] = {
             ...updatedPlayers[claim.guestIndex],
             userId: claim.claimedByUserId,
             isGuest: false
           };
           claimedPlayerFound = true;
        }

        if (claimedPlayerFound) {
          // Add userId to userIds array if not already present
          const userIds = playData.userIds || [];
          if (!userIds.includes(claim.claimedByUserId)) {
            userIds.push(claim.claimedByUserId);
          }
          
          let winnerIds = playData.winnerIds || [];
          if (updatedPlayers[claim.guestIndex]?.isWinner && !winnerIds.includes(claim.claimedByUserId)) {
            winnerIds.push(claim.claimedByUserId);
          }

          const batch = writeBatch(db);
          batch.update(playRef, {
            players: updatedPlayers,
            userIds,
            winnerIds
          });

          // Increment totalWins for new user if they were a winner
          if (updatedPlayers[claim.guestIndex]?.isWinner) {
             const userRef = doc(db, "users", claim.claimedByUserId);
             batch.update(userRef, { totalWins: increment(1) });
          }

          // 2. Update claim status to approved
          const claimRef = doc(db, "claim_approvals", claim.id);
          batch.update(claimRef, { status: "approved" });

          await batch.commit();

          // 3. Update Activity feed for new user
          try {
            const actQ = query(collection(db, "activities"), where("metadata.playId", "==", claim.sessionId));
            const actSnap = await getDocs(actQ);
            
            if (!actSnap.empty) {
              const actDoc = actSnap.docs[0];
              const audienceIds = new Set<string>(actDoc.data().audienceIds || []);
              
              audienceIds.add(claim.claimedByUserId);
              
              // Get followers of the claimed user to fan out to them
              const followersSnap = await getDocs(
                query(collection(db, "users"), where("following", "array-contains", claim.claimedByUserId))
              );
              followersSnap.docs.forEach((d) => audienceIds.add(d.id));
              
              await updateDoc(actDoc.ref, { audienceIds: Array.from(audienceIds) });
            }
          } catch (activityErr) {
            console.error("Failed to update activity feed for the game", activityErr);
          }

          // 4. Trigger Stat Fan-Out for the new user
          await calculateAndStoreAttackClass(claim.claimedByUserId);
        } else {
           alert("Could not locate the guest player in the session document.");
        }
      } else {
        alert("Session document no longer exists.");
        await updateDoc(doc(db, "claim_approvals", claim.id), { status: "rejected_session_not_found" });
      }
    } catch (err) {
      console.error("Failed to approve claim:", err);
      alert("Failed to approve claim.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (claim: ClaimApproval) => {
    setProcessingId(claim.id);
    try {
      await deleteDoc(doc(db, "claim_approvals", claim.id));
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  if (!user || loading || claims.length === 0) return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
      <div className="bg-emerald-accent/10 border border-emerald-accent/40 rounded-[2rem] p-6 lg:p-8 relative overflow-hidden">
        <h2 className="text-xl font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
          <UserCheck className="w-6 h-6 text-emerald-accent" /> Pending Player Claims
        </h2>
        
        <div className="space-y-4">
          {claims.map((claim) => (
            <div key={claim.id} className="bg-charcoal/80 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div>
                <p className="text-white/80 font-medium">
                  <span className="font-bold text-white"><Link to={`/profile/${claim.claimedByUserId}`} className="hover:text-emerald-accent underline decoration-white/20">User {claim.claimedByUserId.substring(0, 5)}</Link></span> wants to claim guest slot <span className="font-bold text-emerald-accent">"{claim.guestName}"</span> in session <span className="font-bold text-white"><Link to={`/sessions/${claim.sessionId}`} className="hover:text-emerald-accent underline decoration-white/20">{claim.sessionId.substring(0,5)}</Link></span>.
                </p>
                <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">Game ID: {claim.gameId}</p>
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={() => handleReject(claim)}
                  disabled={processingId === claim.id}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 hover:bg-rose-500/20 text-white hover:text-rose-400 px-4 py-2 rounded-xl transition-all font-black text-sm uppercase tracking-widest"
                >
                  <X className="w-4 h-4" /> Reject
                </button>
                <button
                  onClick={() => handleApprove(claim)}
                  disabled={processingId === claim.id}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-accent hover:bg-emerald-accent/80 text-charcoal px-4 py-2 rounded-xl transition-all font-black text-sm uppercase tracking-widest disabled:opacity-50"
                >
                  {processingId === claim.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} 
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
