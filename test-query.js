import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, 'games'), where('title', '==', 'A Vos Marques!'));
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log("No game found with exact title 'A Vos Marques!'");
  } else {
    snap.docs.forEach(d => {
      console.log('ID:', d.id);
      console.log('Data:', d.data());
    });
  }
}

run().catch(console.error);
