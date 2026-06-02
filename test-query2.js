import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, 'games'));
  let found = false;
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.title && data.title.includes('Vos Marques')) {
      found = true;
      console.log('ID:', d.id);
      console.log('Data:', data);
    }
  });
  if (!found) console.log("Not found any game with Vos Marques in title");
}
run().catch(console.error);
