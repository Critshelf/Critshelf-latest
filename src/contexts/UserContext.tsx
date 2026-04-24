import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs, limit, onSnapshot } from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from '../lib/firebase';
import { NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from '../services/notificationService';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  username: string; // Unique permanent username
  email: string | null;
  photoURL: string | null;
  avatarPreference?: 'google' | 'dicebear';
  avatarSeed?: string;
  bio?: string;
  location?: string;
  role: string;
  profileTitle?: string;
  notificationPreferences: NotificationPreferences;
  createdAt: string;
  favorites?: any[];
  following?: string[];
  attackClass?: number;
  ratings?: Record<string, number>;
}

export interface GroupRating {
  gameId: string;
  rating: number;
  groupName: string;
}

interface UserContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  groupRatings: Record<string, GroupRating>; // gameId -> { rating, groupName }
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, username: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateNotificationPreferences: (prefs: NotificationPreferences) => Promise<void>;
  isUsernameAvailable: (username: string) => Promise<boolean>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [groupRatings, setGroupRatings] = useState<Record<string, GroupRating>>({});
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string, currentUser: any) => {
    const userDocRef = doc(db, 'users', uid);
    try {
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        
        // Ensure defaults for notifications if missing
        const profileWithDefaults = {
          ...data,
          notificationPreferences: data.notificationPreferences || DEFAULT_NOTIFICATION_PREFERENCES
        };

        // Auto-promote owner if they aren't admin yet
        if (data.email === 'coreykern2040@gmail.com' && data.role !== 'admin') {
          await setDoc(userDocRef, { ...profileWithDefaults, role: 'admin' }, { merge: true });
          setProfile({ ...profileWithDefaults, role: 'admin' });
        } else {
          setProfile(profileWithDefaults);
        }
      } else {
        // Handle new user creation if doc doesn't exist
        const isGoogle = currentUser.providerData[0]?.providerId === 'google.com';
        let fallbackUsername = currentUser.email?.split('@')[0] || `user_${uid.slice(0, 5)}`;
        
        // Ensure fallback doesn't conflict (basic attempt)
        const checkSnap = await getDoc(doc(db, 'usernames', fallbackUsername.toLowerCase()));
        if (checkSnap.exists()) {
          fallbackUsername = `${fallbackUsername}${Math.floor(Math.random() * 1000)}`;
        }

        const initialData: UserProfile = {
          uid: uid,
          displayName: currentUser.displayName || fallbackUsername,
          username: fallbackUsername,
          email: currentUser.email || null,
          photoURL: isGoogle ? (currentUser.photoURL || null) : `https://api.dicebear.com/9.x/avataaars/svg?seed=${fallbackUsername}`,
          avatarPreference: isGoogle ? 'google' : 'dicebear',
          avatarSeed: fallbackUsername,
          role: currentUser.email === 'coreykern2040@gmail.com' ? 'admin' : 'user',
          profileTitle: 'Master Strategist',
          notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, initialData);
        
        // Also reserve the username
        await setDoc(doc(db, 'usernames', fallbackUsername.toLowerCase()), { uid });
        
        setProfile(initialData);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeGroups: (() => void) | null = null;
    let groupListeners: (() => void)[] = [];

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Setup real-time profile listener
        const userDocRef = doc(db, 'users', currentUser.uid);
        unsubscribeProfile = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setProfile({
              ...data,
              notificationPreferences: data.notificationPreferences || DEFAULT_NOTIFICATION_PREFERENCES
            });
          } else {
            // First time login - initialize profile if not existing
            fetchProfile(currentUser.uid, currentUser);
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile Snapshot Error:", error);
          setLoading(false);
        });

        // Setup real-time groups and group ratings listener
        const qGroups = query(collection(db, 'groups'), where('memberIds', 'array-contains', currentUser.uid));
        unsubscribeGroups = onSnapshot(qGroups, (groupsSnap) => {
          // Clean up existing group subcollection listeners
          groupListeners.forEach(un => un());
          groupListeners = [];

          groupsSnap.docs.forEach(groupDoc => {
            const groupData = groupDoc.data();
            const groupName = groupData.name;
            const groupId = groupDoc.id;

            const subUn = onSnapshot(collection(db, 'groups', groupId, 'GroupGames'), (gamesSnap) => {
              setGroupRatings(prev => {
                const next = { ...prev };
                gamesSnap.docs.forEach(gameDoc => {
                  const gameData = gameDoc.data();
                  // Store the rating, potentially overwriting if in multiple groups (simple fallback)
                  next[gameDoc.id] = {
                    gameId: gameDoc.id,
                    rating: gameData.average_d20,
                    groupName: groupName
                  };
                });
                return next;
              });
            }, (error) => {
              console.error(`GroupGames Snapshot Error for ${groupId}:`, error);
            });
            groupListeners.push(subUn);
          });
        }, (error) => {
          console.error("Groups Snapshot Error:", error);
        });
      } else {
        setProfile(null);
        setGroupRatings({});
        if (unsubscribeProfile) unsubscribeProfile();
        if (unsubscribeGroups) unsubscribeGroups();
        groupListeners.forEach(un => un());
        groupListeners = [];
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeGroups) unsubscribeGroups();
      groupListeners.forEach(un => un());
    };
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, username: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      
      const initialData: UserProfile = {
        uid: newUser.uid,
        displayName: username,
        username: username,
        email: email,
        photoURL: `https://api.dicebear.com/9.x/avataaars/svg?seed=${username}`,
        avatarPreference: 'dicebear',
        avatarSeed: username,
        role: email === 'coreykern2040@gmail.com' ? 'admin' : 'user',
        profileTitle: 'Master Strategist',
        notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
        createdAt: new Date().toISOString()
      };
      
      // Create user doc
      await setDoc(doc(db, 'users', newUser.uid), initialData);
      // Reserve username
      await setDoc(doc(db, 'usernames', username.toLowerCase()), { uid: newUser.uid });
      
      setProfile(initialData);
    } catch (error) {
      console.error("Email Signup Error:", error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Email Sign-In Error:", error);
      throw error;
    }
  };

  const updateNotificationPreferences = async (prefs: NotificationPreferences) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { notificationPreferences: prefs }, { merge: true });
      if (profile) {
        setProfile({ ...profile, notificationPreferences: prefs });
      }
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      throw error;
    }
  };

  const isUsernameAvailable = async (username: string) => {
    if (!username || username.length < 3) return false;
    try {
      const docSnap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
      return !docSnap.exists();
    } catch (error) {
      console.error("Username check error:", error);
      return false;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Sign-Out Error:", error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid, user);
    }
  };

  const value = React.useMemo(() => ({ 
    user, 
    profile, 
    groupRatings,
    loading, 
    signInWithGoogle, 
    signUpWithEmail,
    signInWithEmail,
    signOut, 
    refreshProfile,
    updateNotificationPreferences,
    isUsernameAvailable
  }), [
    user, 
    profile, 
    groupRatings, 
    loading, 
    signInWithGoogle, 
    signUpWithEmail, 
    signInWithEmail, 
    signOut, 
    refreshProfile, 
    updateNotificationPreferences, 
    isUsernameAvailable
  ]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );

}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
