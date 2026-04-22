import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
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
  const gameId = 'nemesis';
  const docSnap = await getDoc(doc(db, 'games', gameId));
  if (docSnap.exists()) {
    console.log('Nemesis exists in DB!');
    console.log(JSON.stringify(docSnap.data(), null, 2));
  } else {
    console.log('Nemesis does not exist in DB.');
  }

  const cascadiaSnap = await getDoc(doc(db, 'games', 'cascadia'));
  if (cascadiaSnap.exists()) {
    console.log('Cascadia exists in DB!');
  }
}

checkGame().catch(console.error);
