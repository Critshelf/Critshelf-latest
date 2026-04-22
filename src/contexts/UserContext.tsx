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
import { doc, getDoc, setDoc, query, collection, where, getDocs, limit } from 'firebase/firestore';
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

interface UserContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser.uid, currentUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
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

  return (
    <UserContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      signInWithGoogle, 
      signUpWithEmail,
      signInWithEmail,
      signOut, 
      refreshProfile,
      updateNotificationPreferences,
      isUsernameAvailable
    }}>
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
