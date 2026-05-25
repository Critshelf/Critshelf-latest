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
      const b = d.data().baseGameId;
      if (b !== undefined && b !== null && b !== '') {
         console.log("FOUND VALID baseGameId:", d.id, b);
         c++;
      }
  }
  console.log("Valid baseGameIds total:", c);
  process.exit();
}
run();
