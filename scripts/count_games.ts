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
  console.log("Total games in db:", snap.docs.length);

  for (const doc of snap.docs) {
     const data = doc.data();
     if (data.expansions) {
        console.log("Found expansions!", doc.id);
     }
  }

  process.exit();
}
run();
