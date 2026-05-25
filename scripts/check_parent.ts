import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const gamesRef = collection(db, 'games');
  
  // Try counting docs with parentGameId
  const countQ = query(gamesRef, where('parentGameId', '!=', null));
  const snap = await getDocs(countQ);
  console.log("Docs with parentGameId:", snap.docs.length);

  process.exit();
}
run();
