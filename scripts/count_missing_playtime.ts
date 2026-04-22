
import { db } from '../src/lib/firebase';
import { collection, getDocs, query, where, or } from 'firebase/firestore';

async function countMissingPlayTime() {
  console.log('Counting games with missing playTime...');
  
  try {
    const gamesRef = collection(db, 'games');
    
    // We can't easily query "is null" for property that might not exist vs exists as null in a single query with or
    // So we'll just fetch all games and count in memory since we have around 4k games which is manageable for a one-off script
    const snapshot = await getDocs(gamesRef);
    
    let missingCount = 0;
    let totalCount = 0;
    const missingSamples: string[] = [];
    
    snapshot.forEach(doc => {
      totalCount++;
      const data = doc.data();
      if (data.playTime === null || data.playTime === undefined || data.playTime === '') {
        missingCount++;
        if (missingSamples.length < 10) {
          missingSamples.push(data.title || 'Untitled');
        }
      }
    });
    
    console.log(`\nResults:`);
    console.log(`Total games in database: ${totalCount}`);
    console.log(`Games with missing/null playTime: ${missingCount}`);
    console.log(`Percentage missing: ${((missingCount / totalCount) * 100).toFixed(2)}%`);
    console.log(`\nSample games missing playtime:`, missingSamples);
    
  } catch (error) {
    console.error('Error counting games:', error);
  }
}

countMissingPlayTime();
