import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query, documentId, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const gamesRef = collection(db, 'games');
  
  // Try finding specific expansion titles like Wingspan Asia or Scythe Invaders from Afar
  const searchQ = query(gamesRef, where('title', '==', 'Wingspan Asia'));
  const searchSnap = await getDocs(searchQ);
  console.log("Found Wingspan Asia:", searchSnap.docs.length);
  for (const d of searchSnap.docs) {
    console.log(d.id, d.data());
  }
  
  const searchQ2 = query(gamesRef, where('title', '==', '7 Wonders Duel'));
  const searchSnap2 = await getDocs(searchQ2);
  console.log("Found 7 Wonders Duel:", searchSnap2.docs.length);
  for (const d of searchSnap2.docs) {
     console.log(d.id, d.data());
  }

  process.exit();
}
run();
