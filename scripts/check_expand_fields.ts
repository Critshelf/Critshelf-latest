import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const gamesRef = collection(db, 'games');
  const snapshot = await getDocs(gamesRef);

  for (const d of snapshot.docs) {
     const data = d.data();
     for (const key of Object.keys(data)) {
        if (key.toLowerCase().includes('expand') || key.toLowerCase().includes('expans')) {
           console.log(d.id, "has field:", key);
        }
     }
  }
  process.exit();
}
run();
