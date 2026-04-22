import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
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

async function countBgg() {
  const q = query(collection(db, 'games'));
  const snap = await getDocs(q);
  let count = 0;
  snap.forEach(doc => {
    if (doc.data().bggId) count++;
  });
  console.log(`Total games with BGG ID: ${count}`);
}

countBgg().catch(console.error);
