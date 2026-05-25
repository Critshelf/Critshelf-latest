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
     const expRef = collection(db, `games/${d.id}/expansions`);
     const expSnap = await getDocs(expRef);
     if (expSnap.docs.length > 0) {
        console.log(d.id, "has an expansions subcollection! Count:", expSnap.docs.length);
        c++;
        if (c > 5) break;
     }
  }
  process.exit();
}
run();
