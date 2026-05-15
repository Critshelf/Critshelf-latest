import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { Game } from '../components/GameCard';

const RECENT_GAMES_CACHE_KEY = 'cachedRecentGames_v4';
const CACHE_TTL = 72 * 60 * 60 * 1000; // 72 hours

export function useRecentGames() {
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentGames = async () => {
      try {
        // 1. Check Cache first
        const cached = localStorage.getItem(RECENT_GAMES_CACHE_KEY);
        if (cached) {
          try {
            const { data, timestamp } = JSON.parse(cached);
            const isExpired = Date.now() - timestamp > CACHE_TTL;
            
            if (!isExpired && Array.isArray(data) && data.length > 0) {
              console.log('Using cached recent games (TTL valid)');
              setRecentGames(data);
              setLoading(false);
              return;
            }
          } catch (e) {
            localStorage.removeItem(RECENT_GAMES_CACHE_KEY);
          }
        }

        // 2. Fetch fresh games if cache miss or expired
        console.log('Fetching fresh recent games from Firestore...');
        
        let games: Game[] = [];
        
        // Level 1: Non-expansions sorted
        try {
          const qStrict = query(
            collection(db, 'games'),
            where('isExpansion', '==', false),
            orderBy('createdAt', 'desc'),
            limit(10)
          );
          const snap = await getDocs(qStrict);
          games = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
        } catch (err: any) {
          console.warn('Level 1 Recent Games fetch failed:', err.message);
        }

        // Level 2: Fallback (Just sorted by date, no composite index/filters)
        if (games.length === 0) {
          try {
            const qFallback = query(
              collection(db, 'games'),
              orderBy('createdAt', 'desc'),
              limit(10)
            );
            const snap = await getDocs(qFallback);
            games = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
          } catch (err: any) {
            console.warn('Level 2 Recent Games fetch failed:', err.message);
          }
        }

        // Level 3: Absolute Fallback (Just any 10 games)
        if (games.length === 0) {
          try {
            const qAbsolute = query(collection(db, 'games'), limit(10));
            const snap = await getDocs(qAbsolute);
            games = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
          } catch (err: any) {
            console.warn('Level 3 Recent Games fetch failed:', err.message);
          }
        }

        // 3. Update state and cache
        if (games.length > 0) {
          setRecentGames(games);
          localStorage.setItem(RECENT_GAMES_CACHE_KEY, JSON.stringify({
            data: games,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error('Critical error in useRecentGames:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentGames();
  }, []);

  return { recentGames, loading };
}
