import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const gamesRef = collection(db, 'games');
  
  const searchQ = query(gamesRef, where('title', '==', 'Arkham Horror'));
  const snap = await getDocs(searchQ);
  console.log("Arkham Horror docs:", snap.docs.length);
  for (const d of snap.docs) {
     console.log(d.id, d.data());
  }

  process.exit();
}
run();
