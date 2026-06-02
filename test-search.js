import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit, where, orderBy } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || undefined);

async function run() {
  const queryTerm = 'a vos marques';
  console.log('searching for: ' + queryTerm);
  const q = query(
    collection(db, 'games'),
    where('name_lowercase', '>=', queryTerm),
    where('name_lowercase', '<=', queryTerm + '\uf8ff'),
    orderBy('name_lowercase'),
    limit(10)
  );
  try {
    const snap = await getDocs(q);
    console.log('Result count:', snap.docs.length);
    snap.docs.forEach(d => console.log('Title:', d.data().title));
    process.exit(0);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
}
run();
