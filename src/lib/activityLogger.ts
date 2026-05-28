import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type ActivityType = 
  | 'play_logged' 
  | 'game_added' 
  | 'new_member' 
  | 'event_created' 
  | 'poll_started' 
  | 'group_created'
  | 'game_brought'
  | 'review_added';

export interface ActivityMetadata {
  gameId?: string;
  gameTitle?: string;
  gameCover?: string;
  isArtApproved?: boolean;
  eventId?: string;
  eventTitle?: string;
  pollId?: string;
  pollTitle?: string;
  shelf?: string;
  groupName?: string;
  dateTime?: any;
  score?: number;
  text?: string;
  winners?: string[];
}

export interface LogActivityParams {
  userId: string;
  userName: string;
  avatarSeed: string;
  type: ActivityType;
  groupId?: string;
  groupName?: string;
  groupIds?: string[];
  userIds?: string[];
  metadata?: ActivityMetadata;
}

/**
 * Logs a major action to the central activities collection for the global feed.
 */
export async function logActivity({
  userId,
  userName,
  avatarSeed,
  type,
  groupId,
  groupName,
  groupIds,
  userIds,
  metadata = {}
}: LogActivityParams) {
  try {
    const activityRef = collection(db, 'activities');
    await addDoc(activityRef, {
      userId,
      userName,
      avatarSeed,
      type,
      groupId: groupId || null,
      groupName: groupName || null,
      groupIds: groupIds || (groupId ? [groupId] : []),
      userIds: userIds || [userId],
      metadata,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    // Non-blocking error, we don't want to prevent the main action from succeeding
  }
}
