import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const gamesRef = collection(db, 'games');
  
  // Just get literally everything and count ANY baseGameId
  const snap = await getDocs(gamesRef);
  let c = 0;
  for (const d of snap.docs) {
      if (d.data().baseGameId && d.data().baseGameId !== null) {
         console.log(d.id, typeof d.data().baseGameId, d.data().baseGameId);
         c++;
      }
  }
  console.log("Documents with non-null baseGameId:", c);

  process.exit();
}
run();
