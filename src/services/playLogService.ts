import { db, handleFirestoreError, OperationType } from "../lib/firebase";
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
  updateDoc,
  writeBatch,
  increment,
  or,
  and,
  limit,
} from "firebase/firestore";
import { calculateBaseDC, calculateFinalDC } from "../lib/dcUtils";
import { sendNotification } from "./notificationService";

export interface PlayLogPayload {
  gameId: string;
  gameTitle: string;
  groupId?: string;
  groupIds?: string[];
  rating: number; // D20_Rating (1-20)
  vibeTag: string;
  userId: string;
  userName: string;
  userAvatar: string;
  gameCover: string;
  isArtApproved?: boolean;
  players: any[];
  location: string;
  date: string;
  includedExpansions?: { id: string; title: string }[];
}

/**
 * Core mathematical logic for determining a user's Attack Class based on their plays and game complexities.
 */
export function calculateLocalAttackClass(
  userId: string,
  playsData: any[],
  gamesMap: Map<string, any>,
): number {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  // 1. Filter plays for this user from the last 12 months
  const userPlays = playsData.filter((p) => {
    // Accommodate timestamp objects or standard dates
    let dateObj = p.playDate;
    if (p.playDate && typeof p.playDate.toDate === "function") {
      dateObj = p.playDate.toDate();
    } else if (typeof p.playDate === "string") {
      dateObj = new Date(p.playDate);
    }

    return p.userIds?.includes(userId) && dateObj && dateObj >= oneYearAgo;
  });

  if (userPlays.length === 0) return 0;

  // 2. Extract unique game IDs directly from plays (cap at 20)
  const rawGameIds = Array.from(new Set(userPlays.map((p) => p.gameId))).slice(
    0,
    20,
  );

  // 3. Match against game data to get base DC
  const gameDCs = rawGameIds
    .map((gameId) => {
      const gameData = gamesMap.get(gameId);
      if (!gameData) return null;
      return calculateBaseDC(gameData);
    })
    .filter((dc): dc is number => dc !== null);

  if (gameDCs.length === 0) return 0;

  // 4. Calculate average and round
  const averageAC = gameDCs.reduce((acc, val) => acc + val, 0) / gameDCs.length;
  return Math.round(averageAC);
}

/**
 * Calculates the Attack Class (AC) for a user based on the last 12 months of plays.
 */
export async function calculateAndStoreAttackClass(userId: string) {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // 1. Get plays for this user (filtering dates locally to avoid composite index requirement)
    const playsQuery = query(
      collection(db, "plays"),
      where("userIds", "array-contains", userId),
      limit(1000),
    );
    const playsSnap = await getDocs(playsQuery);

    const validDocs = playsSnap.docs.filter((d) => {
      const data = d.data();
      let dateObj = data.playDate;
      if (data.playDate && typeof data.playDate.toDate === "function") {
        dateObj = data.playDate.toDate();
      } else if (typeof data.playDate === "string") {
        dateObj = new Date(data.playDate);
      }
      return dateObj && dateObj >= oneYearAgo;
    });

    if (validDocs.length === 0) {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().attackClass !== 0) {
        await updateDoc(userRef, { attackClass: 0 });
      }
      return;
    }

    // 2. Extract unique game IDs
    const rawGameIds = Array.from(
      new Set(validDocs.map((d) => d.data().gameId)),
    ).slice(0, 20);

    // 3. For each unique game, get a quick mock base DC
    const gameDCPromises = rawGameIds.map(async (gameId) => {
      const gameDoc = await getDoc(doc(db, "games", gameId));
      if (!gameDoc.exists()) return null;

      const gameData = { id: gameDoc.id, ...gameDoc.data() };
      return calculateBaseDC(gameData);
    });

    const gameDCs = (await Promise.all(gameDCPromises)).filter(
      (dc): dc is number => dc !== null,
    );

    if (gameDCs.length === 0) {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().attackClass !== 0) {
        await updateDoc(userRef, { attackClass: 0 });
      }
      return;
    }

    // 4. Calculate average and round
    const averageAC =
      gameDCs.reduce((acc, val) => acc + val, 0) / gameDCs.length;
    const finalAC = Math.round(averageAC);

    // 5. Store in user profile only if the Attack Class has changed
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && userSnap.data().attackClass !== finalAC) {
      await updateDoc(userRef, { attackClass: finalAC });
    }
  } catch (error) {
    console.error("Firebase Query Error:", error);
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
    includedExpansions,
  } = payload;

  try {
    // 1. Convert to writeBatch for atomic updates
    const sessionPath = "plays";
    const isWinner = players.some((p) => p.userId === userId && p.isWinner);
    const winnerIds = players
      .filter((p) => p.isWinner)
      .map((p) => p.userId)
      .filter(Boolean);
    const userIds = Array.from(
      new Set([userId, ...players.map((p) => p.userId).filter(Boolean)]),
    );

    const cleanPlayers = players.map(p => Object.fromEntries(Object.entries(p).filter(([_, v]) => v !== undefined)));

    const batch = writeBatch(db);

    // Action A: Create the main play document with userIds
    const playDocRef = doc(collection(db, sessionPath));
    batch.set(playDocRef, {
      userId,
      gameId,
      gameTitle,
      date, // string date for display
      playDate: new Date(date), // true Firestore Timestamp
      location,
      players: cleanPlayers,
      userIds, // Array of ALL participant IDs
      isWinner,
      winnerIds,
      rating,
      vibeTag,
      createdAt: serverTimestamp(),
      gameCover,
      isArtApproved: payload.isArtApproved ?? false,
      includedExpansions: includedExpansions || [],
    });

    // Action B: Increment totalWins for every player marked as a "winner"
    winnerIds.forEach((winnerId) => {
      const userRef = doc(db, "users", winnerId);
      batch.update(userRef, {
        totalWins: increment(1),
      });
    });

    // Commit the batch
    await batch.commit();

    // Fire off notifications to all tagged participants (excluding the actor)
    players.forEach((p) => {
      if (p.userId && p.userId !== userId) {
        sendNotification(
          p.userId,
          "TAGGED_IN_PLAY",
          "Tagged in Play",
          `${userName} tagged you in a play of ${gameTitle}!`,
          {
            gameId,
            playId: playDocRef.id,
            actorId: userId,
            actionUrl: `/game/${gameId}`,
          },
        ).catch((err) => console.error("Failed to send tag notification", err));
      }
    });

    // 3. Update Attack Class (Rolling 12-Month)
    // We do this after logging the play so the new play is included for all participants
    userIds.forEach((uid) => {
      calculateAndStoreAttackClass(uid).catch(console.error);
    });

    // 4. Handle Group Stats Transaction (Running Totals)
    // Only execute if a group is linked to this session
    if (groupId) {
      // Target the specific game document within the group: Groups/{LinkedGroupID}/GroupGames/{GameID}
      const groupGameRef = doc(db, "groups", groupId, "GroupGames", gameId);

      await runTransaction(db, async (transaction) => {
        const groupGameDoc = await transaction.get(groupGameRef);

        if (!groupGameDoc.exists()) {
          // Check for Existence: If the document doesn't exist (first time playing this game),
          // create it with initial values.
          transaction.set(groupGameRef, {
            total_d20_score: rating,
            rating_count: 1,
            average_d20: rating,
            vibe_counts: { [vibeTag]: 1 },
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
          const newAverage =
            Math.round((newTotalScore / newRatingCount) * 10) / 10;

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
            vibe_counts: newVibeCounts,
          });
        }
      });
    }

    return { success: true, playId: playDocRef.id };
  } catch (error) {
    // Use the custom error handler to provide context for debugging security rules or other issues
    handleFirestoreError(
      error,
      OperationType.WRITE,
      groupId ? `groups/${groupId}/GroupGames/${gameId}` : "gameSessions",
    );
    return { success: false, error };
  }
}
