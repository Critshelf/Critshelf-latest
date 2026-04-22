
import { db } from '../src/lib/firebase';
import { collection, getDocs, writeBatch, serverTimestamp, query, where, limit, doc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

const CSV_FILE = path.resolve(process.cwd(), 'boardgame-geek-dataset_organized.csv');
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function loadPlaytimeMap(): Promise<Map<string, number>> {
  const playtimeMap = new Map<string, number>();
  console.log('Loading CSV into memory...');
  
  return new Promise((resolve, reject) => {
    let rowCount = 0;
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on('data', (row) => {
        rowCount++;
        if (row.url && row.max_playtime) {
          const match = row.url.match(/boardgame\/(\d+)/);
          if (match) {
            const bggId = match[1];
            const maxPlaytime = parseInt(row.max_playtime);
            if (!isNaN(maxPlaytime)) {
              playtimeMap.set(bggId, maxPlaytime);
            }
          }
        }
      })
      .on('end', () => {
        console.log(`CSV parsing finished.`);
        console.log(`Total rows processed: ${rowCount}`);
        console.log(`Total unique BGG IDs mapped: ${playtimeMap.size}`);
        resolve(playtimeMap);
      })
      .on('error', (err) => {
        console.error('CRITICAL: Error reading CSV file:', err);
        reject(err);
      });
  });
}

async function patchPlayTime() {
  console.log(`Starting Playtime Patch from ${CSV_FILE}...`);

  // 1. Load CSV into memory first
  const playtimeMap = await loadPlaytimeMap();
  console.log(`Starting patch process with ${playtimeMap.size} mappings loaded.`);

  let totalPatched = 0;
  let chunkCount = 0;

  // 2. Fetch Target Games & Patch in chunks
  while (true) {
    chunkCount++;
    console.log(`\n--- Fetching Chunk #${chunkCount} (Total Patched: ${totalPatched}) ---`);
    
    // Fetch up to 500 games needing update
    const qNull = query(collection(db, 'games'), where('playTime', '==', null), limit(500));
    let snapshot = await getDocs(qNull);
    
    if (snapshot.empty) {
      const qNA = query(collection(db, 'games'), where('playTime', '==', 'N/A'), limit(500));
      snapshot = await getDocs(qNA);
    }

    if (snapshot.empty) {
      console.log('No more games with null or "N/A" playTime found.');
      break;
    }

    let batch = writeBatch(db);
    let batchSize = 0;
    let chunkPatched = 0;
    let processedInChunk = 0;

    for (const gameDocSnapshot of snapshot.docs) {
      processedInChunk++;
      const data = gameDocSnapshot.data();
      const bggId = data.bggId;
      const gameId = gameDocSnapshot.id;
      
      if (bggId && playtimeMap.has(bggId)) {
        const rawTime = playtimeMap.get(bggId);
        const parsedTime = parseInt(rawTime as any, 10);
        
        const patchData: any = {};
        if (!Number.isNaN(parsedTime) && parsedTime > 0) {
          patchData.playTime = parsedTime;
          patchData.updatedAt = serverTimestamp();
        }

        if (Object.keys(patchData).length === 0) {
          continue;
        }

        try {
          const gameRef = doc(db, 'games', gameId);
          batch.set(gameRef, patchData, { merge: true });
          
          totalPatched++;
          chunkPatched++;
          batchSize++;

          if (batchSize >= 499) {
            console.log(`Committing sub-batch of ${batchSize} updates...`);
            await batch.commit();
            batch = writeBatch(db);
            batchSize = 0;
          }
        } catch (err: any) {
          console.error("Failed to stage BGG ID:", bggId, "Error:", err.message);
        }
      }
    }

    if (batchSize > 0) {
      try {
        console.log(`Committing final batch of ${batchSize} updates for this chunk...`);
        await batch.commit();
      } catch (err: any) {
        console.error("CRITICAL: Batch commit failed. Error:", err.message);
      }
    }

    console.log(`Chunk complete. Processed ${processedInChunk} docs, patched ${chunkPatched} matches.`);
    
    if (chunkPatched === 0) {
      console.log('No games in this chunk matched CSV data. Continuing to check for N/A or remaining nulls...');
      // If we are in the N/A loop and still getting 0 matches, we should break to avoid infinite loop
      const checkNA = query(collection(db, 'games'), where('playTime', '==', 'N/A'), limit(1));
      const naSnap = await getDocs(checkNA);
      if (naSnap.empty) break;
    }

    console.log('Sleeping for 1s...');
    await sleep(1000);
  }

  console.log(`\nPatching complete!`);
  console.log(`Total games successfully patched: ${totalPatched}`);
}

patchPlayTime().catch(console.error);
