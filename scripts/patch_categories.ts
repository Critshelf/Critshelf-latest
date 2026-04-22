import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Initialize Firebase
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

const BATCH_SIZE = 100;
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function patchCategories() {
  console.log('\x1b[36m%s\x1b[0m', '🚀 Starting Category & Mechanic Patch Script...');

  try {
    // Step 1: Fetch games and filter for auto-resume
    const gamesRef = collection(db, 'games');
    const snapshot = await getDocs(gamesRef);
    const allGames = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    
    // Auto-Resume Filter: Only include games where categories is undefined
    const unprocessedGames = allGames.filter(game => game.categories === undefined);
    
    console.log(`Total unprocessed games remaining: ${unprocessedGames.length}`);
    
    // Safe Batching
    const gamesToPatch = unprocessedGames.slice(0, BATCH_SIZE);
    console.log(`Processing batch of ${gamesToPatch.length} games.`);

    let successCount = 0;
    let failCount = 0;

    for (const game of gamesToPatch) {
      if (!game.wikidataId) {
        // Mark as processed even if no wikidataId to avoid re-scanning
        await setDoc(doc(db, 'games', game.id), { categories: [] }, { merge: true });
        console.log(`Skipping ${game.title}: No Wikidata ID found. Marked as processed.`);
        successCount++;
        continue;
      }

      console.log(`Patching ${game.title} (${game.wikidataId})...`);

      // Step 2: Surgical SPARQL Query for Genre (P136) and Mechanic (P4151)
      const sparqlQuery = `
        SELECT (GROUP_CONCAT(DISTINCT ?label; separator="|") AS ?combinedLabels)
        WHERE {
          BIND(wd:${game.wikidataId} AS ?game)
          {
            ?game wdt:P136 ?item. # Genre
          } UNION {
            ?game wdt:P4151 ?item. # Game Mechanic
          }
          ?item rdfs:label ?label.
          FILTER(LANG(?label) = "en")
        }
      `;

      try {
        const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(sparqlQuery)}&format=json`;
        const response = await fetch(url, {
          headers: { 'User-Agent': 'CritShelfPatchScript/1.0 (coreykern2040@gmail.com)' }
        });

        if (!response.ok) throw new Error(`Wikidata error: ${response.statusText}`);

        const data = await response.json();
        const combinedString = data.results.bindings[0]?.combinedLabels?.value || "";
        const categories = combinedString ? combinedString.split('|') : [];

        // Step 3: Safe Data Merge
        // Always write categories (even if empty) so script knows it's processed
        await setDoc(doc(db, 'games', game.id), { categories }, { merge: true });
        
        if (categories.length > 0) {
          console.log('\x1b[32m%s\x1b[0m', `✅ Patched ${game.title} with ${categories.length} categories.`);
        } else {
          console.log(`No data found for ${game.title}, marked as processed with empty array.`);
        }
        successCount++;

        // 500ms delay to respect rate limits
        await sleep(500);

      } catch (error) {
        console.error(`❌ Failed to patch ${game.title}:`, error);
        failCount++;
      }
    }

    console.log('\x1b[36m%s\x1b[0m', '-----------------------------------');
    console.log('\x1b[36m%s\x1b[0m', `🏁 Patching Finished!`);
    console.log('\x1b[32m%s\x1b[0m', `✅ Successful: ${successCount}`);
    console.log('\x1b[31m%s\x1b[0m', `❌ Failed: ${failCount}`);

  } catch (error) {
    console.error('Fatal script error:', error);
  }
}

patchCategories();
