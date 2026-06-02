import { initializeApp } from 'firebase/app';
import { getFirestore, updateDoc, doc, deleteField, getDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || undefined);

async function run() {
  const gameId = '--vos-marques-';
  const ref = doc(db, 'games', gameId);
  const snap = await getDoc(ref);
  const draftState = { id: snap.id, ...snap.data() };
  
  const payload = {};
  const columns = Object.keys(draftState);
  columns.forEach((col) => {
    if (col === "id") return;
    let val = draftState[col];
    if (val === undefined || val === null || val === "") {
      payload[col] = deleteField();
      return;
    }

    if (typeof val === "string") {
      const trimmed = val.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          val = JSON.parse(trimmed);
        } catch (e) {
          console.warn(`Failed to parse json for field ${col}`);
        }
      }
    }
    if (val !== undefined && val !== null && val !== "") {
      payload[col] = val;
    }
  });

  if (payload.title && typeof payload.title === "string") {
    payload.name_lowercase = payload.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  payload.updatedAt = serverTimestamp();

  console.log("Payload:", payload);
  
  try {
    await updateDoc(ref, payload);
    console.log("Success with CMS payload.");
    process.exit(0);
  } catch (err) {
    console.error("Payload failed:", err.code, err.message);
    process.exit(1);
  }
}
run();
