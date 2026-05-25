import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const gamesRef = collection(db, 'games');
  const snap = await getDocs(query(gamesRef));
  
  const allKeys = new Set<string>();
  for (const d of snap.docs) {
     for (const key of Object.keys(d.data())) {
       allKeys.add(key);
     }
  }
  
  console.log("ALL KEYS IN DB:", Array.from(allKeys));
  process.exit();
}
run();
