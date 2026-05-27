import { db, messaging } from '../lib/firebase';
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
  getDocs,
  updateDoc
} from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';

export type NotificationType = 'moderation' | 'social' | 'library' | 'groups' | 'group_invite';

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
  if (!userId) {
    console.error("🚨 CRITICAL: sendNotification called with null or undefined userId!");
    throw new Error("sendNotification requires a valid userId");
  }

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

/**
 * Request notification permissions and register Firebase Cloud Messaging token
 */
export async function setupPushNotifications(userId: string) {
  console.warn("FCM setup: Remember to generate and set your VAPID key in the Firebase Console and update the placeholder below.");
  
  if (!('Notification' in window)) {
    console.log('This browser does not support desktop notifications.');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      if (messaging) {
        // Replace with your generated VAPID key
        const token = await getToken(messaging, { vapidKey: 'BBCIYgwGbz8l64n1SMEZfOAnt-U7haTsWRSPlzlnXWa7CDmTyvf549-2ewJ-O-X09yuGpd1gXIOb-qtdPW2pVF0' });
        
        if (token) {
          // Store token in Firestore for the user
          const userDocRef = doc(db, 'users', userId);
          await updateDoc(userDocRef, { fcmToken: token });
          console.log('FCM Token stored for user.');
          
          // Foreground message handler
          onMessage(messaging, (payload) => {
            console.log('Message received in foreground: ', payload);
            const notificationTitle = payload.notification?.title || 'New Notification';
            const notificationOptions = {
              body: payload.notification?.body,
              icon: '/icon.png',
            };
            
            // Note: If you want to show a native notification even in the foreground, you can do this:
            // new Notification(notificationTitle, notificationOptions);
          });
        }
      }
    } else {
      console.log('Unable to get permission to notify.');
    }
  } catch (error) {
    console.error('An error occurred while setting up push notifications.', error);
  }
}
