import React from 'react';
import { cn } from '../lib/utils';
import DCShield from './DCShield';
import { calculateBaseDC, calculateFinalDC } from '../lib/dcUtils';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

interface GameTitleWithDCProps {
  game: any;
  titleClassName?: string;
  shieldSize?: 'sm' | 'md' | 'lg';
  containerClassName?: string;
  shouldTruncate?: boolean;
}

export default function GameTitleWithDC({ 
  game, 
  titleClassName, 
  shieldSize = 'sm',
  containerClassName,
  shouldTruncate = true
}: GameTitleWithDCProps) {
  const [dcValue, setDcValue] = React.useState<number | '-'>('-');
  const [totalRatings, setTotalRatings] = React.useState(0);

  React.useEffect(() => {
    const fetchDC = async () => {
      const baseDC = calculateBaseDC(game);
      try {
        const q = query(
          collection(db, 'reviews'), 
          where('gameId', '==', game.id || game.gameId),
          limit(20)
        );
        const snapshot = await getDocs(q);
        const reviews = snapshot.docs.map(doc => doc.data());
        const difficultyRatings = reviews
          .map(r => r.difficultyRating)
          .filter(r => typeof r === 'number');

        setTotalRatings(difficultyRatings.length);

        if (difficultyRatings.length > 0) {
          setDcValue(calculateFinalDC(baseDC, difficultyRatings));
        } else {
          setDcValue(baseDC);
        }
      } catch (err) {
        setDcValue(baseDC);
        setTotalRatings(0);
      }
    };

    fetchDC();
  }, [game]);

  return (
    <div className={cn("flex items-center gap-2 min-w-0 max-w-full", containerClassName)}>
      <h3 className={cn(
        "font-black tracking-tight leading-tight min-w-0",
        shouldTruncate ? "truncate" : "whitespace-normal text-wrap",
        titleClassName
      )}>
        {game.title || game.gameTitle}
      </h3>
      <DCShield value={dcValue} size={shieldSize} totalUserRatings={totalRatings} />
    </div>
  );
}
