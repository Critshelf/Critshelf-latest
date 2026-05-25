import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const gamesRef = collection(db, 'games');
  const snapshot = await getDocs(gamesRef);
  let countBase = 0;
  let countParent = 0;
  let countIsExp = 0;
  let countExpansionsArray = 0;

  for (const d of snapshot.docs) {
     const data = d.data();
     if (data.baseGameId) countBase++;
     if (data.parentGameId) countParent++;
     if (data.isExpansion) countIsExp++;
     if (data.expansions && Array.isArray(data.expansions)) countExpansionsArray++;
     
     if (data.expansions?.length > 0) {
       console.log("GAME HAS EXPANSIONS ARRAY:", data.title, data.expansions);
       break;
     }
  }
  console.log(`baseGameId: ${countBase}, parentGameId: ${countParent}, isExpansion: ${countIsExp}, expansions array: ${countExpansionsArray}`);
  process.exit();
}
run();
