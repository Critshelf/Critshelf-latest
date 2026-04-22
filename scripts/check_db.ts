import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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

async function countGames() {
  const snapshot = await getDocs(collection(db, 'games'));
  console.log(`Total games in Firestore: ${snapshot.size}`);
  if (snapshot.size > 0) {
    console.log('Sample game data:', JSON.stringify(snapshot.docs[0].data(), null, 2));
  }
}

countGames().catch(console.error);
