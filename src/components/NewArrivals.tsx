import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { Game } from './GameCard';
import { cn } from '../lib/utils';
import GameTitleWithDC from './GameTitleWithDC';

export default function NewArrivals() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNewArrivals = async () => {
      const path = 'games';
      try {
        // Try sorting by createdAt first
        const q = query(
          collection(db, path), 
          where('isApproved', '==', true),
          orderBy('createdAt', 'desc'), 
          limit(5)
        );
        const snapshot = await getDocs(q);
        const gameList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
        setGames(gameList);
      } catch (error) {
        console.warn("Retrying fetchNewArrivals with fallback sort...");
        try {
          // Fallback to document ID sorting if createdAt doesn't exist on all docs
          const qFallback = query(
            collection(db, path), 
            where('isApproved', '==', true),
            orderBy('__name__', 'desc'), 
            limit(5)
          );
          const snapshot = await getDocs(qFallback);
          const gameList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
          setGames(gameList);
        } catch (fallbackError) {
          handleFirestoreError(fallbackError, OperationType.LIST, path);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchNewArrivals();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 mb-12 animate-pulse">
        <div className="h-8 w-48 bg-white/5 rounded-lg mb-6" />
        <div className="flex gap-6 overflow-hidden">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex-none w-44 h-72 bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (games.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-6 mb-12 pt-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-emerald-accent/10 rounded-xl flex items-center justify-center border border-emerald-accent/20">
          <Sparkles className="w-6 h-6 text-emerald-accent" />
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">New Arrivals</h2>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-4 no-scrollbar snap-x snap-mandatory">
        {games.map((game) => (
          <Link 
            key={game.id} 
            to={`/game/${game.id}`}
            className="flex-none w-44 snap-start group"
          >
            <div className="bg-charcoal rounded-2xl overflow-hidden border border-white/10 group-hover:border-emerald-accent/50 transition-all duration-300 shadow-xl flex flex-col h-full border-b-2 border-b-emerald-accent/30">
              <div className="h-56 overflow-hidden relative bg-black/20">
                {/* Blurred Background Banner */}
                <img 
                  src={game.bannerImage || game.coverImage || undefined} 
                  alt=""
                  className={cn(
                    "absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-125",
                    !game.bannerImage ? "blur-xl opacity-40" : "opacity-60"
                  )}
                  style={game.bannerImage ? game.bannerStyles : undefined}
                  referrerPolicy="no-referrer"
                />
                
                {/* Optional: Overlay the title or keep it below */}
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal to-transparent opacity-60" />
                
                {/* Small indicator for newness */}
                <div className="absolute top-3 right-3 bg-emerald-accent text-charcoal text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg">
                  New
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-center relative z-10">
                <GameTitleWithDC 
                  game={game} 
                  shieldSize="sm" 
                  titleClassName="font-bold text-white text-sm line-clamp-2 transition-colors group-hover:text-emerald-accent"
                />
                <p className="text-white/40 text-xs font-bold mt-1">
                  {game.publishingYear || 'N/A'}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
