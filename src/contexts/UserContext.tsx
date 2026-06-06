import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
import { NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES, setupPushNotifications } from '../services/notificationService';

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
  totalWins?: number;
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
  userGroupIds: string[];
  groupRatings: Record<string, GroupRating>; // gameId -> { rating, groupName }
  friendsRatings: Record<string, number>; // gameId -> rating average
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
  const [userGroupIds, setUserGroupIds] = useState<string[]>([]);
  const [groupRatings, setGroupRatings] = useState<Record<string, GroupRating>>({});
  const [friendsRatings, setFriendsRatings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const hasTriggeredAC = useRef(false);

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
          totalWins: 0,
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
    const groupListeners = new Map<string, () => void>();

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Setup real-time profile listener
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        // Let's also set up push notifications
        setupPushNotifications(currentUser.uid).catch(console.error);

        unsubscribeProfile = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            
            // Trigger AC init if it's completely missing
            if ((data.attackClass === undefined || data.attackClass === null) && !hasTriggeredAC.current) {
              hasTriggeredAC.current = true;
              import('../services/playLogService').then(({ calculateAndStoreAttackClass }) => {
                calculateAndStoreAttackClass(currentUser.uid).catch(console.error);
              });
            }

            // Only update profile state if something actually changed (prevents re-render loops)
            setProfile(prevProfile => {
              const newProfile = {
                ...data,
                notificationPreferences: data.notificationPreferences || DEFAULT_NOTIFICATION_PREFERENCES
              };
              if (JSON.stringify(prevProfile) === JSON.stringify(newProfile)) {
                return prevProfile;
              }
              return newProfile;
            });
          } else {
            // First time login - initialize profile if not existing
            fetchProfile(currentUser.uid, currentUser);
          }
          setLoading(false);
        }, (error) => {
          if (error.code === 'resource-exhausted') {
            console.error("Profile Snapshot Error (Quota Exceeded)");
          }
          setLoading(false);
        });

        // One-time fetch of groups and group ratings
        const fetchGroupsAndRatings = async () => {
          try {
            const qGroups = query(collection(db, 'groups'), where('memberIds', 'array-contains', currentUser.uid));
            const groupsSnap = await getDocs(qGroups);
            
            setUserGroupIds(groupsSnap.docs.map(doc => doc.id));
            
            const ratingsMap: Record<string, GroupRating> = {};
            const ratingPromises = groupsSnap.docs.map(async (groupDoc) => {
              const groupId = groupDoc.id;
              const groupName = groupDoc.data().name;
              
              const gamesSnap = await getDocs(collection(db, 'groups', groupId, 'GroupGames'));
              gamesSnap.docs.forEach(gameDoc => {
                ratingsMap[gameDoc.id] = {
                  gameId: gameDoc.id,
                  rating: gameDoc.data().average_d20,
                  groupName: groupName
                };
              });
            });

            await Promise.all(ratingPromises);
            setGroupRatings(ratingsMap);
          } catch (error: any) {
            if (error.code !== 'resource-exhausted') {
              console.error("Groups Fetch Error:", error);
            }
          }
        };

        fetchGroupsAndRatings();
      } else {
        setProfile(null);
        setGroupRatings({});
        if (unsubscribeProfile) unsubscribeProfile();
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
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
        totalWins: 0,
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

  useEffect(() => {
    const fetchFriendsRatings = async () => {
      const following = profile?.following || [];
      const userIds = [user?.uid, ...following].filter(Boolean) as string[];

      if (userIds.length === 0) {
        setFriendsRatings({});
        return;
      }
      try {
        const chunks = [];
        for (let i = 0; i < userIds.length; i += 10) {
          chunks.push(userIds.slice(i, i + 10));
        }
        const newRatings: Record<string, { total: number; count: number }> = {};
        
        const promises = chunks.map(chunk => 
          getDocs(query(collection(db, 'reviews'), where('userId', 'in', chunk)))
        );
        
        const snaps = await Promise.all(promises);
        snaps.forEach(snap => {
          snap.docs.forEach(doc => {
            const rev = doc.data();
            if (rev.gameId && typeof rev.score === 'number') {
              if (!newRatings[rev.gameId]) {
                newRatings[rev.gameId] = { total: 0, count: 0 };
              }
              newRatings[rev.gameId].total += rev.score;
              newRatings[rev.gameId].count += 1;
            }
          });
        });
        
        const averageRatings: Record<string, number> = {};
        for (const [gameId, data] of Object.entries(newRatings)) {
          averageRatings[gameId] = Math.round(data.total / data.count);
        }
        setFriendsRatings(averageRatings);
      } catch (error) {
        console.error("Error fetching friends ratings:", error);
      }
    };

    fetchFriendsRatings();
  }, [profile?.following?.length, user?.uid]); // simplified dependency to length for efficiency

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid, user);
    }
  };

  const value = React.useMemo(() => ({ 
    user, 
    profile, 
    userGroupIds,
    groupRatings,
    friendsRatings,
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
    userGroupIds,
    groupRatings,
    friendsRatings,
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
