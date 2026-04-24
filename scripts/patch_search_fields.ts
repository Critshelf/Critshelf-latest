import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Load configuration
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

async function patchSearchFields() {
  console.log("🚀 Starting Search Index Patch...");
  
  const gamesSnap = await getDocs(collection(db, 'games'));
  const allGames = gamesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  
  console.log(`Checking ${allGames.length} games...`);
  
  const gamesToPatch = allGames.filter((g: any) => !g.name_lowercase);
  
  console.log(`Found ${gamesToPatch.length} games missing 'name_lowercase'.`);
  
  if (gamesToPatch.length === 0) {
    console.log("✅ All games are already indexed. Exiting.");
    return;
  }

  let batch = writeBatch(db);
  let batchCount = 0;
  const BATCH_LIMIT = 500;

  for (const game of gamesToPatch) {
    const title = game.title || game.name;
    
    if (!title) {
      console.warn(`⚠️ Skipping game with ID ${game.id} - no title or name found. Keys: ${Object.keys(game).join(', ')}`);
      continue;
    }

    const name_lowercase = title.toLowerCase();
    
    batch.update(doc(db, 'games', game.id), { name_lowercase });
    batchCount++;

    if (batchCount >= BATCH_LIMIT) {
      console.log(`Committing batch of ${batchCount}...`);
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    console.log(`Committing final batch of ${batchCount}...`);
    await batch.commit();
  }

  console.log("🏁 Patch complete.");
}

patchSearchFields().catch(console.error);
