
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function deduplicateGames() {
  console.log('--- Phase 1: Scanning Games Collection ---');
  const querySnapshot = await getDocs(collection(db, 'games'));
  console.log(`Total documents found: ${querySnapshot.size}`);

  const gamesByBggId: { [key: string]: any[] } = {};
  const gamesByName: { [key: string]: any[] } = {};
  const toDelete: string[] = [];

  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const docId = docSnap.id;
    const bggId = data.bggId ? String(data.bggId) : null;
    const name = data.name ? data.name.toLowerCase().trim() : null;

    if (bggId) {
      if (!gamesByBggId[bggId]) gamesByBggId[bggId] = [];
      gamesByBggId[bggId].push({ id: docId, ...data });
    } else if (name) {
      if (!gamesByName[name]) gamesByName[name] = [];
      gamesByName[name].push({ id: docId, ...data });
    }
  });

  console.log('--- Phase 2: Identifying Duplicates ---');

  // Logic: If multiple docs have the same BGG ID, keep the one where docId === bggId.
  // If none match specifically, keep the first one found.
  for (const bggId in gamesByBggId) {
    const group = gamesByBggId[bggId];
    if (group.length > 1) {
      console.log(`Found ${group.length} docs for BGG ID: ${bggId}`);
      
      // Find the "best" doc to keep (prefer docId matching bggId)
      let keepIndex = group.findIndex(g => g.id === bggId);
      if (keepIndex === -1) keepIndex = 0; // Fallback to first

      group.forEach((game, index) => {
        if (index !== keepIndex) {
          toDelete.push(game.id);
        }
      });
    }
  }

  // Same for name-based matches (for games without BGG IDs)
  for (const name in gamesByName) {
    const group = gamesByName[name];
    if (group.length > 1) {
      console.log(`Found ${group.length} docs for Name: ${name}`);
      group.slice(1).forEach(game => toDelete.push(game.id));
    }
  }

  if (toDelete.length === 0) {
    console.log('No duplicates found. Database is clean.');
    process.exit(0);
  }

  console.log(`\n--- Phase 3: Deleting ${toDelete.length} Duplicate Documents ---`);
  
  const CHUNK_SIZE = 500;
  for (let i = 0; i < toDelete.length; i += CHUNK_SIZE) {
    const chunk = toDelete.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    
    chunk.forEach(id => {
      batch.delete(doc(db, 'games', id));
    });

    await batch.commit();
    console.log(`Batch processed: Deleted ${chunk.length} items.`);
  }

  console.log('\nDeduplication complete!');
  process.exit(0);
}

deduplicateGames().catch(err => {
  console.error('Deduplication Error:', err);
  process.exit(1);
});
