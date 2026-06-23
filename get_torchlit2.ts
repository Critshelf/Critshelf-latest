import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, limit } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || "(default)");

async function run() {
  try {
    console.log("Fetching games...");
    const gamesSnap = await getDocs(query(collection(db, "games"), where("title", "==", "Torchlit"), limit(5)));
    gamesSnap.forEach(d => console.log("games", d.id));

    console.log("Fetching art_approvals...");
    const artSnap = await getDocs(query(collection(db, "art_approvals"), where("gameTitle", "==", "Torchlit"), limit(5)));
    artSnap.forEach(d => console.log("art_approvals", d.id, d.data().imageUrl));
  } catch(e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
run();
