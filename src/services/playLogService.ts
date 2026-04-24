import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  doc, 
  runTransaction, 
  serverTimestamp, 
  collection, 
  addDoc,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { calculateBaseDC, calculateFinalDC } from '../lib/dcUtils';

export interface PlayLogPayload {
  gameId: string;
  gameTitle: string;
  groupId?: string;
  rating: number; // D20_Rating (1-20)
  vibeTag: string;
  userId: string;
  userName: string;
  userAvatar: string;
  gameCover: string;
  players: any[];
  location: string;
  date: string;
  includedExpansions?: { id: string; title: string }[];
}

/**
 * Calculates the Attack Class (AC) for a user based on the last 12 months of plays.
 */
async function calculateAndStoreAttackClass(userId: string) {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // 1. Get plays from the last 12 months
    const playsQuery = query(
      collection(db, 'plays'),
      where('userId', '==', userId),
      where('playDate', '>=', oneYearAgo)
    );
    const playsSnap = await getDocs(playsQuery);
    
    if (playsSnap.empty) {
      await updateDoc(doc(db, 'users', userId), { attackClass: 0 });
      return;
    }

    // 2. Get unique game IDs, normalizing expansions to their base games
    const rawGameIds = Array.from(new Set(playsSnap.docs.map(d => d.data().gameId)));
    const normalizedGameIdsMap = new Set<string>();

    await Promise.all(rawGameIds.map(async (id) => {
      const gDoc = await getDoc(doc(db, 'games', id));
      if (gDoc.exists()) {
        const data = gDoc.data();
        const finalId = data.baseGameId || id;
        normalizedGameIdsMap.add(finalId);
      }
    }));

    const uniqueGameIds = Array.from(normalizedGameIdsMap);

    // 3. For each unique game, get its DC_Final
    const gameDCPromises = uniqueGameIds.map(async (gameId) => {
      const gameDoc = await getDoc(doc(db, 'games', gameId));
      if (!gameDoc.exists()) return null;
      
      const gameData = { id: gameDoc.id, ...gameDoc.data() };
      const baseDC = calculateBaseDC(gameData);

      // Fetch reviews to get community DC
      const reviewsQuery = query(collection(db, 'reviews'), where('gameId', '==', gameId));
      const reviewsSnap = await getDocs(reviewsQuery);
      const difficultyRatings = reviewsSnap.docs
        .map(d => d.data().difficultyRating)
        .filter(r => typeof r === 'number');

      return difficultyRatings.length > 0 
        ? calculateFinalDC(baseDC, difficultyRatings)
        : baseDC;
    });

    const gameDCs = (await Promise.all(gameDCPromises)).filter((dc): dc is number => dc !== null);

    if (gameDCs.length === 0) {
      await updateDoc(doc(db, 'users', userId), { attackClass: 0 });
      return;
    }

    // 4. Calculate average and round
    const averageAC = gameDCs.reduce((acc, val) => acc + val, 0) / gameDCs.length;
    const finalAC = Math.round(averageAC);

    // 5. Store in user profile
    await updateDoc(doc(db, 'users', userId), { attackClass: finalAC });
  } catch (error) {
    console.error("Error updating Attack Class:", error);
  }
}

/**
 * Submits a play log and updates group-specific game statistics using a Firestore transaction.
 * This handles calculating the proprietary "Group D20 Average" and aggregating "Vibe Tags".
 */
export async function submitPlayLog(payload: PlayLogPayload) {
  const { 
    gameId, 
    groupId, 
    rating, 
    vibeTag, 
    userId, 
    userName, 
    userAvatar, 
    gameTitle, 
    gameCover,
    players,
    location,
    date,
    includedExpansions
  } = payload;

  try {
    // 1. Create the main game session record
    const sessionPath = 'plays';
    const isWinner = players.some(p => p.userId === userId && p.isWinner);
    const winnerIds = players.filter(p => p.isWinner).map(p => p.userId).filter(Boolean);

    await addDoc(collection(db, sessionPath), {
      userId,
      gameId,
      gameTitle,
      date, // string date for display
      playDate: new Date(date), // true Firestore Timestamp
      location,
      players,
      isWinner,
      winnerIds,
      rating,
      vibeTag,
      createdAt: serverTimestamp(),
      gameCover,
      includedExpansions: includedExpansions || []
    });

    // 2. Create activity feed item
    const activityPath = 'activities';
    await addDoc(collection(db, activityPath), {
      userId,
      userName,
      userAvatar,
      type: 'play',
      gameId,
      gameTitle,
      gameCover,
      details: `${userName} logged a play of ${gameTitle}!`,
      rating,
      createdAt: serverTimestamp()
    });

    // 3. Update Attack Class (Rolling 12-Month)
    // We do this after logging the play so the new play is included
    await calculateAndStoreAttackClass(userId);

    // 4. Handle Group Stats Transaction (Running Totals)
    // Only execute if a group is linked to this session
    if (groupId) {
      // Target the specific game document within the group: Groups/{LinkedGroupID}/GroupGames/{GameID}
      const groupGameRef = doc(db, 'groups', groupId, 'GroupGames', gameId);

      await runTransaction(db, async (transaction) => {
        const groupGameDoc = await transaction.get(groupGameRef);

        if (!groupGameDoc.exists()) {
          // Check for Existence: If the document doesn't exist (first time playing this game),
          // create it with initial values.
          transaction.set(groupGameRef, {
            total_d20_score: rating,
            rating_count: 1,
            average_d20: rating,
            vibe_counts: { [vibeTag]: 1 }
          });
        } else {
          // Update Existing Data: If it does exist, calculate the new aggregated data.
          const data = groupGameDoc.data();
          
          // Math Logic:
          // 1. Increment rating_count by 1
          const newRatingCount = (data.rating_count || 0) + 1;
          
          // 2. Add the new D20_Rating to the existing total_d20_score
          const newTotalScore = (data.total_d20_score || 0) + rating;
          
          // 3. Calculate the new average: (total_d20_score / rating_count)
          // Round this to one decimal place and save it as average_d20
          const newAverage = Math.round((newTotalScore / newRatingCount) * 10) / 10;
          
          // 4. Update the vibe_counts map
          const newVibeCounts = { ...(data.vibe_counts || {}) };
          if (newVibeCounts[vibeTag]) {
            // If the submitted Vibe_Tag exists, increment its count by 1
            newVibeCounts[vibeTag] += 1;
          } else {
            // If not, add it and set the count to 1
            newVibeCounts[vibeTag] = 1;
          }

          transaction.update(groupGameRef, {
            total_d20_score: newTotalScore,
            rating_count: newRatingCount,
            average_d20: newAverage,
            vibe_counts: newVibeCounts
          });
        }
      });
    }

    return { success: true };
  } catch (error) {
    // Use the custom error handler to provide context for debugging security rules or other issues
    handleFirestoreError(
      error, 
      OperationType.WRITE, 
      groupId ? `groups/${groupId}/GroupGames/${gameId}` : 'gameSessions'
    );
    return { success: false, error };
  }
}
