import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// --- STEP 1: CONFIGURATION VARIABLES ---
const BATCH_SIZE = 100;
const CURRENT_OFFSET = 500;

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

const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';
const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/w/api.php';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- STEP 3: Wikipedia API Helper ---
async function fetchWikipediaDescription(articleTitle: string) {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    exintro: 'true',
    explaintext: 'true',
    titles: articleTitle,
    format: 'json',
    origin: '*'
  });

  try {
    const response = await fetch(`${WIKIPEDIA_API_URL}?${params.toString()}`);
    if (!response.ok) return "";
    const data = await response.json();
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    return pages[pageId].extract || "";
  } catch (error) {
    return "";
  }
}

async function runUnifiedImport() {
  console.log('\x1b[36m%s\x1b[0m', `🚀 Starting Unified Import Pipeline (Batch: ${BATCH_SIZE}, Offset: ${CURRENT_OFFSET})...`);

  // --- STEP 2: THE MASTER SPARQL QUERY ---
  const sparqlQuery = `
    SELECT ?game ?gameLabel ?minPlayers ?maxPlayers ?playTime ?year 
           (GROUP_CONCAT(DISTINCT ?publisherLabel; separator="|") AS ?publishers) 
           (GROUP_CONCAT(DISTINCT ?designerLabel; separator="|") AS ?designers) 
           (GROUP_CONCAT(DISTINCT ?artistLabel; separator="|") AS ?artists) 
           ?wikipediaUrl
    WHERE {
      ?game wdt:P31 wd:Q131436. # Instance of board game
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      
      OPTIONAL { ?game wdt:P1872 ?minPlayers. }
      OPTIONAL { ?game wdt:P1873 ?maxPlayers. }
      OPTIONAL { 
        ?game wdt:P2559 ?pt1. 
        OPTIONAL { ?game wdt:P3047 ?pt2. }
        BIND(COALESCE(?pt1, ?pt2) AS ?playTime)
      }
      
      OPTIONAL { ?game wdt:P577 ?date. BIND(YEAR(?date) AS ?year) }
      
      OPTIONAL { 
        ?game wdt:P123 ?publisher. 
        ?publisher rdfs:label ?publisherLabel. 
        FILTER(LANG(?publisherLabel) = "en") 
      }
      OPTIONAL { 
        ?game wdt:P287 ?designer. 
        ?designer rdfs:label ?designerLabel. 
        FILTER(LANG(?designerLabel) = "en") 
      }
      OPTIONAL { 
        ?game wdt:P110 ?artist. 
        ?artist rdfs:label ?artistLabel. 
        FILTER(LANG(?artistLabel) = "en") 
      }
      OPTIONAL { 
        ?wikipediaUrl schema:about ?game; 
                      schema:isPartOf <https://en.wikipedia.org/>. 
      }
    }
    GROUP BY ?game ?gameLabel ?minPlayers ?maxPlayers ?playTime ?year ?wikipediaUrl
    ORDER BY ?game
    LIMIT ${BATCH_SIZE}
    OFFSET ${CURRENT_OFFSET}
  `;

  const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(sparqlQuery)}&format=json`;
  
  let results = [];
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'CritShelfUnifiedPipeline/2.0 (coreykern2040@gmail.com)' }
    });
    if (!response.ok) throw new Error(`Wikidata SPARQL error: ${response.statusText}`);
    const data = await response.json();
    results = data.results.bindings;
    console.log(`Found ${results.length} games to process.`);
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Fatal error fetching Wikidata batch:', error);
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  // --- STEP 3: THE RESILIENT PROCESSING LOOP ---
  for (const result of results) {
    const wikidataUrl = result.game.value;
    const wikidataId = wikidataUrl.split('/entity/')[1];
    const title = result.gameLabel.value;
    const gameId = title.toLowerCase().replace(/[^a-z0-9]/g, '-');

    try {
      console.log(`Processing: ${title} (${wikidataId})...`);

      // --- STEP 4: CONSTRUCT GAME OBJECT ---
      const gameData: any = {
        title: title,
        wikidataId: wikidataId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        trending: false,
        coverImage: `https://picsum.photos/seed/${gameId}/800/1200`,
      };

      // Gameplay Stats
      if (result.minPlayers) gameData.minPlayers = parseInt(result.minPlayers.value);
      if (result.maxPlayers) gameData.maxPlayers = parseInt(result.maxPlayers.value);
      if (result.playTime) gameData.playTime = `${result.playTime.value} min`;
      
      // Derived strings for UI
      if (gameData.minPlayers && gameData.maxPlayers) {
        gameData.playerCount = gameData.minPlayers === gameData.maxPlayers 
          ? `${gameData.minPlayers} Players` 
          : `${gameData.minPlayers}-${gameData.maxPlayers} Players`;
      }

      // Enrichment Metadata
      if (result.year) gameData.publishingYear = parseInt(result.year.value);
      if (result.publishers?.value) gameData.publishers = result.publishers.value.split('|');
      if (result.designers?.value) gameData.designers = result.designers.value.split('|');
      if (result.artists?.value) gameData.artists = result.artists.value.split('|');

      // Wikipedia Description
      let description = "";
      if (result.wikipediaUrl) {
        const wikipediaUrl = result.wikipediaUrl.value;
        const articleTitle = decodeURIComponent(wikipediaUrl.split('/wiki/')[1]);
        
        // 1-second delay between Wikipedia calls
        await sleep(1000);
        description = await fetchWikipediaDescription(articleTitle);
      }

      gameData.description = description || "No description available.";

      // --- STEP 4: FIRESTORE WRITE ---
      await setDoc(doc(db, 'games', gameId), gameData, { merge: true });
      
      console.log('\x1b[32m%s\x1b[0m', `✅ Success: ${title}`);
      successCount++;

    } catch (error) {
      console.error('\x1b[31m%s\x1b[0m', `❌ Error processing ${wikidataId} (${title}):`, error);
      failCount++;
      continue;
    }
  }

  console.log('\x1b[36m%s\x1b[0m', '-----------------------------------');
  console.log('\x1b[36m%s\x1b[0m', `🏁 Pipeline Finished!`);
  console.log('\x1b[32m%s\x1b[0m', `✅ Successful: ${successCount}`);
  console.log('\x1b[31m%s\x1b[0m', `❌ Failed: ${failCount}`);
}

runUnifiedImport().catch(err => {
  console.error('Unexpected pipeline crash:', err);
  process.exit(1);
});
