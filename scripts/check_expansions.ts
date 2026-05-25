import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, limit } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const gamesRef = collection(db, 'games');
  const snapshot = await getDocs(query(gamesRef, where('isExpansion', '==', true), limit(2)));
  console.log("IsExpansion == true:", snapshot.docs.length);
  for (const d of snapshot.docs) {
    console.log(d.id, d.data().title, d.data().baseGameId, d.data().parentGameId);
  }
  
  const snap2 = await getDocs(query(gamesRef, limit(100)));
  for (const d of snap2.docs) {
     if (d.data().expansions && d.data().expansions.length > 0) {
        console.log("Found expansions array in:", d.id, d.data().title, d.data().expansions.length, d.data().expansions[0]);
     }
  }
  process.exit();
}
run();
