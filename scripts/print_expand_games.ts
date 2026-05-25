import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const ids = ['Q201274', 'Q237072', 'rl6Cg9IZ0dhEPAq3BMXq', 'wikidata_Q20757081', 'wikidata_Q811019'];
  for (const id of ids) {
    const d = await getDoc(doc(db, 'games', id));
    if (d.exists()) {
       console.log(id, d.data());
    }
  }
  process.exit();
}
run();
