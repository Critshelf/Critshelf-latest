import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  appId: config.appId
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, config.firestoreDatabaseId);

async function checkGame() {
  const q = query(collection(db, 'games'), where('title', '==', 'Ark Nova'));
  const snap = await getDocs(q);
  if (!snap.empty) {
    console.log('Ark Nova exists!');
    console.log(JSON.stringify(snap.docs[0].data(), null, 2));
  } else {
    console.log('Ark Nova not found.');
  }

  const q2 = query(collection(db, 'games'), where('bggId', '==', '342942'));
  const snap2 = await getDocs(q2);
  if (!snap2.empty) {
    console.log('Game with BGG ID 342942 exists!');
    console.log(JSON.stringify(snap2.docs[0].data(), null, 2));
  } else {
    console.log('BGG ID 342942 not found.');
  }
}

checkGame().catch(console.error);
