import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || "(default)");

async function run() {
  try {
    const gameSnap = await getDoc(doc(db, "games", "wDwAXMoNtEqUixEFwW2H"));
    console.log("Torchlit Data:", JSON.stringify(gameSnap.data(), null, 2));
  } catch(e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
run();
