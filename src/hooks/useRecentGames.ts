import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Game } from '../components/GameCard';

export function useRecentGames() {
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isSubscribed = true;
    let unsubscribeFallback: (() => void) | undefined;
    let unsubscribeAbsolute: (() => void) | undefined;

    setLoading(true);

    const qStrict = query(
      collection(db, 'games'),
      where('isExpansion', '==', false),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(
      qStrict,
      (snap) => {
        if (!isSubscribed) return;
        const games = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
        if (games.length > 0) {
          setRecentGames(games);
          setLoading(false);
        } else {
            // Level 2 Fallback
            const qFallback = query(
              collection(db, 'games'),
              orderBy('createdAt', 'desc'),
              limit(5)
            );
            unsubscribeFallback = onSnapshot(qFallback, (fallbackSnap) => {
                if (!isSubscribed) return;
                const fbGames = fallbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
                if (fbGames.length > 0) {
                    setRecentGames(fbGames);
                    setLoading(false);
                } else {
                    // Level 3
                    const qAbsolute = query(collection(db, 'games'), limit(5));
                    unsubscribeAbsolute = onSnapshot(qAbsolute, (absSnap) => {
                        if (!isSubscribed) return;
                        const absGames = absSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
                        setRecentGames(absGames);
                        setLoading(false);
                    }, (err) => {
                         console.warn('Level 3 Recent Games fetch failed:', err.message);
                         if (isSubscribed) setLoading(false);
                    });
                }
            }, (fallbackErr) => {
                 console.warn('Level 2 Recent Games fetch failed:', fallbackErr.message);
                 if (isSubscribed) setLoading(false);
            });
        }
      },
      (err) => {
        console.warn('Level 1 Recent Games fetch failed:', err.message);
        if (!isSubscribed) return;
        
        const qFallback = query(
          collection(db, 'games'),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        unsubscribeFallback = onSnapshot(qFallback, (fallbackSnap) => {
            if (!isSubscribed) return;
            const fbGames = fallbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
            if (fbGames.length > 0) {
                setRecentGames(fbGames);
                setLoading(false);
            } else {
                 const qAbsolute = query(collection(db, 'games'), limit(5));
                 unsubscribeAbsolute = onSnapshot(qAbsolute, (absSnap) => {
                     if (!isSubscribed) return;
                     const absGames = absSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
                     setRecentGames(absGames);
                     setLoading(false);
                 }, (err) => {
                     console.warn('Level 3 fetch failed:', err.message);
                     if (isSubscribed) setLoading(false);
                 });
            }
        }, (fallbackErr) => {
             console.warn('Level 2 fetch failed:', fallbackErr.message);
             if (!isSubscribed) return;
             const qAbsolute = query(collection(db, 'games'), limit(5));
             unsubscribeAbsolute = onSnapshot(qAbsolute, (absSnap) => {
                 if (!isSubscribed) return;
                 const absGames = absSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
                 setRecentGames(absGames);
                 setLoading(false);
             }, (err) => {
                 console.warn('Level 3 absolute fetch failed:', err.message);
                 if (isSubscribed) setLoading(false);
             });
        });
      }
    );

    return () => {
      isSubscribed = false;
      unsubscribe();
      if (unsubscribeFallback) unsubscribeFallback();
      if (unsubscribeAbsolute) unsubscribeAbsolute();
    };
  }, []);

  return { recentGames, loading };
}
