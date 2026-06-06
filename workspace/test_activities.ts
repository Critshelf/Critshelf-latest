import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, orderBy, limit, query } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const acts = await getDocs(query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(20)));
  acts.forEach(doc => console.log(doc.id, doc.data()));
}
run();
