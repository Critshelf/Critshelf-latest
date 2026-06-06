import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const q = query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(20));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const data = doc.data();
    if (data.targetName && data.targetName.toLowerCase().includes("baseball")) {
      console.log(doc.id, JSON.stringify(data, null, 2));
    }
  });
  console.log("Done");
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
