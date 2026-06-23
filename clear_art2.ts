import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || "(default)");

async function run() {
  try {
    const artSnap = await getDocs(collection(db, "art_approvals"));
    let deletedCount = 0;
    for(const d of artSnap.docs) {
      if(d.data().gameTitle === "Torchlit" || d.data().gameId === "wDwAXMoNtEqUixEFwW2H") {
         await deleteDoc(doc(db, "art_approvals", d.id));
         deletedCount++;
      }
    }
    console.log(`Deleted ${deletedCount} art approval records for Torchlit`);
  } catch(e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
run();
