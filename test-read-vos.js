import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || undefined);

async function run() {
  const q = query(collection(db, 'games'));
  const snap = await getDocs(q);
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.title && data.title.includes('Vos Marques!')) {
      console.log('ID:', d.id);
      console.log('Data:', data);
    }
  });
  console.log("Done looping.");
  process.exit(0);
}
run().catch(console.error);
