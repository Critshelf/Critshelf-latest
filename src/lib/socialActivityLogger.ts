import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export type SocialActivityType =
  | "LOG_PLAY"
  | "RATE_GAME"
  | "REVIEW_GAME"
  | "COLLECTION_ADD"
  | "POLL_RESULT"
  | "SESSION_SCHEDULED"
  | "GAME_REQUESTED";

export interface SocialActivityPayload {
  type: SocialActivityType;
  actorId: string;
  actorName: string;
  targetId: string;
  targetName: string;
  metadata?: any;
}

export async function logSocialActivity({
  type,
  actorId,
  actorName,
  targetId,
  targetName,
  metadata = {},
}: SocialActivityPayload) {
  try {
    const audienceIds = new Set<string>();

    // Always include the actor
    audienceIds.add(actorId);

    let actorAC = 0;

    try {
      // Fetch actor's data
      const userDocRef = doc(db, "users", actorId);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        actorAC = userDoc.data().attackClass || 0;
      }

      // Find users who follow the actor
      const followersSnap = await getDocs(
        query(collection(db, "users"), where("following", "array-contains", actorId))
      );
      followersSnap.docs.forEach((d) => audienceIds.add(d.id));
    } catch (err) {
      console.error("Error fetching followers for audienceIds:", err);
    }

    const groupIds: string[] = [];

    try {
      // Fetch all groups the actor is in and add all members
      const groupsSnap = await getDocs(
        query(
          collection(db, "groups"),
          where("memberIds", "array-contains", actorId),
        ),
      );
      groupsSnap.docs.forEach((d) => {
        groupIds.push(d.id);
        const memberIds = d.data().memberIds || [];
        memberIds.forEach((m: string) => audienceIds.add(m));
      });
    } catch (err) {
      console.error("Error fetching groups for audienceIds:", err);
    }

    const finalAudience = [...audienceIds];

    const cleanMetadata = Object.fromEntries(
      Object.entries(metadata).filter(([_, v]) => v !== undefined)
    );

    const activityRef = collection(db, "activities");
    await addDoc(activityRef, {
      type,
      actorId,
      actorName,
      actorAC,
      targetId,
      targetName,
      audienceIds: finalAudience,
      groupIds,
      metadata: cleanMetadata,
      createdAt: serverTimestamp(),
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error logging social activity:", error);
  }
}

export interface GroupActivityPayload {
  type: SocialActivityType;
  groupId: string;
  actorId: string;
  actorName: string;
  targetId: string;
  targetName: string;
  metadata?: any;
}

export async function logGroupActivity({
  type,
  groupId,
  actorId,
  actorName,
  targetId,
  targetName,
  metadata = {},
}: GroupActivityPayload) {
  try {
    const audienceIds = new Set<string>();

    // Always include the actor
    audienceIds.add(actorId);

    // Fetch group members
    let actorAC = 0;
    const actorDocRef = doc(db, "users", actorId);
    const actorDoc = await getDoc(actorDocRef);
    if (actorDoc.exists()) {
      actorAC = actorDoc.data().attackClass || 0;
    }

    const groupDocRef = doc(db, "groups", groupId);
    const groupDoc = await getDoc(groupDocRef);
    if (groupDoc.exists()) {
      const memberIds = groupDoc.data().memberIds || [];
      memberIds.forEach((m: string) => audienceIds.add(m));
    }

    const finalAudience = [...audienceIds];

    const cleanMetadata = Object.fromEntries(
      Object.entries({ ...metadata, groupId }).filter(([_, v]) => v !== undefined)
    );

    const activityRef = collection(db, "activities");
    await addDoc(activityRef, {
      type,
      actorId,
      actorName,
      actorAC,
      targetId,
      targetName,
      audienceIds: finalAudience,
      groupIds: [groupId],
      metadata: cleanMetadata,
      createdAt: serverTimestamp(),
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error logging group activity:", error);
  }
}
