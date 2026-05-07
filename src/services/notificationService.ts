import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  writeBatch,
  getDocs
} from 'firebase/firestore';

export type NotificationType = 'moderation' | 'social' | 'library' | 'groups';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: any;
  actionUrl?: string;
  groupId?: string;
  gameId?: string;
  targetId?: string;
}

export interface NotificationPreferences {
  moderation: boolean;
  social: boolean;
  library: boolean;
  groups: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  moderation: true,
  social: true,
  library: true,
  groups: true
};

/**
 * Dispatches a notification to a user if their preferences allow it.
 */
export async function sendNotification(
  userId: string, 
  type: NotificationType, 
  title: string, 
  message: string, 
  context?: {
    actionUrl?: string;
    groupId?: string;
    gameId?: string;
    targetId?: string;
  }
) {
  try {
    // 1. Fetch user's notification preferences
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) return;
    
    const userData = userDoc.data();
    const prefs: NotificationPreferences = userData.notificationPreferences || DEFAULT_NOTIFICATION_PREFERENCES;
    
    // 2. Check if the specific toggle is enabled
    if (prefs[type] === false) {
      console.log(`Notification of type ${type} is disabled for user ${userId}`);
      return;
    }
    
    // 3. Create the notification document in the user's sub-collection
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    await addDoc(notificationsRef, {
      type,
      title,
      message,
      actionUrl: context?.actionUrl || null,
      groupId: context?.groupId || null,
      gameId: context?.gameId || null,
      targetId: context?.targetId || null,
      isRead: false,
      createdAt: serverTimestamp()
    });
    
    console.log(`Notification sent to ${userId}: ${title}`);
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}

/**
 * Marks all unread notifications for a user as read.
 */
export async function markAllAsRead(userId: string) {
  try {
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    const q = query(notificationsRef, where('isRead', '==', false));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;
    
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { isRead: true });
    });
    
    await batch.commit();
  } catch (error) {
    console.error("Error marking all as read:", error);
  }
}

/**
 * Marks a single notification as read.
 */
export async function markAsRead(userId: string, notificationId: string) {
  try {
    const notificationRef = doc(db, 'users', userId, 'notifications', notificationId);
    await writeBatch(db).update(notificationRef, { isRead: true }).commit();
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
}
