import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const gamesRef = collection(db, 'games');
  const snap = await getDocs(query(gamesRef, limit(100)));
  
  for (const d of snap.docs) {
     if (d.data().wikidataId) {
         console.log("GAME WITH WIKIDATA ID:", d.id, d.data().title, d.data().wikidataId);
     }
  }
  process.exit();
}
run();
