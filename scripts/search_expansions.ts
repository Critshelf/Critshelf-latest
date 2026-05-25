import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const gamesRef = collection(db, 'games');
  const snap = await getDocs(gamesRef);
  let c = 0;
  for (const d of snap.docs) {
     if (d.data().title?.includes('Duel') || d.data().title?.includes('Expansion')) {
       console.log(d.id, d.data().title, "Fields:", Object.keys(d.data()));
       if (d.data().title?.includes('Expansion')) {
          console.log("Expansion Data:", d.data());
       }
       c++;
       if (c > 5) break;
     }
  }
  process.exit();
}
run();
