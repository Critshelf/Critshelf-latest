import { initializeApp } from 'firebase/app';
import { getFirestore, updateDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || undefined);

async function run() {
  const gameId = '--vos-marques-';
  const ref = doc(db, 'games', gameId);
  try {
    const payload = {};
    payload['description'] = "This is a test description over 10 chars";
    await updateDoc(ref, payload);
    console.log("Success");
    process.exit(0);
  } catch (err) {
    console.error("Payload failed:", err.code, err.message);
    process.exit(1);
  }
}
run();
