import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch, serverTimestamp, getDocs, query, collection } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

// --- CONFIGURATION ---
const BATCH_SIZE = 50; 
const CONCURRENCY = 3; 
const JOB_LIMIT = 1000; 
const UPDATE_EXISTING = false; 
const CSV_FILE_PATH = path.join(process.cwd(), 'games.csv');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function log(msg: string) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

async function fetchWithRetry(url: string, options: any = {}, retries = 3): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); 

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, ...options.headers }
    });
    clearTimeout(timeoutId);
    if (!response.ok && retries > 0) {
      log(`Response not OK (${response.status}). Retrying...`);
      await sleep(3000);
      return fetchWithRetry(url, options, retries - 1);
    }
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (retries > 0) {
      log(`Fetch error (${error.message}). Retrying...`);
      await sleep(3000);
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

function extractBggId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/boardgame\/(\d+)\//);
  return match ? match[1] : null;
}

function processImage(rawUrl: string | null, title: string) {
  const seed = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const imageUrl = rawUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(seed)}`;
  
  let bannerImage = imageUrl;
  if (imageUrl.includes('wikimedia.org') || imageUrl.includes('wikipedia.org')) {
    bannerImage = `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&blur=20&bri=-20`;
  }

  return {
    coverImage: imageUrl,
    bannerImage,
    bannerStyles: {
      filter: 'blur(20px) brightness(0.8)',
      opacity: 0.3,
      transform: 'scale(1.1)'
    }
  };
}

async function getExistingBggIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const q = query(collection(db, 'games'));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const data = doc.data();
    if (data.bggId) ids.add(data.bggId);
  });
  return ids;
}

async function runImporter() {
  log("🚀 Starting Batched Wikidata Importer...");
  
  const existingBggIds = await getExistingBggIds();
  log(`Checking database... Found ${existingBggIds.size} games already in Firestore.`);

  const csvData = fs.readFileSync(CSV_FILE_PATH, 'utf8');
  const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
  const csvRows = parsed.data as any[]; 
  
  const remainingGamesQueue = csvRows.filter(row => {
    const id = row.objectid;
    if (!id) return false;
    return UPDATE_EXISTING || !existingBggIds.has(id);
  });

  const skippedCount = csvRows.length - remainingGamesQueue.length;
  log(`Pre-flight check complete:`);
  log(`- Total games in CSV: ${csvRows.length}`);
  log(`- Games skipped (already in DB): ${skippedCount}`);
  log(`- Games remaining to process: ${remainingGamesQueue.length}`);

  let missingQueue = remainingGamesQueue;
  if (missingQueue.length > JOB_LIMIT) {
    missingQueue = missingQueue.slice(0, JOB_LIMIT);
    log(`Capping this run to ${JOB_LIMIT} games.`);
  }

  if (missingQueue.length === 0) {
    log("✅ Everything up to date. No new games to import.");
    return;
  }

  async function executeSparql(sparqlQuery: string) {
    const body = new URLSearchParams();
    body.append('query', sparqlQuery);
    body.append('format', 'json');

    const response = await fetchWithRetry(WIKIDATA_SPARQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json'
      },
      body: body.toString()
    });
    if (!response.ok) throw new Error(`SPARQL failed: ${response.status}`);
    const data = await response.json() as any;
    return data.results.bindings;
  }

  async function processBatch(currentChunk: any[], batchIndex: number, totalBatches: number) {
    const rowsWithIds = currentChunk.map(row => ({
      ...row,
      bggId: row.objectid
    })).filter(r => r.bggId);

    if (rowsWithIds.length === 0) return;

    const gameTitle = currentChunk[0].name || currentChunk[0].boardgame || "Unknown";
    log(`[Batch ${batchIndex}/${totalBatches}] Processing chunk starting with: "${gameTitle}"`);

    let finalResults: any[] = [];
    const bggIds = rowsWithIds.map(r => r.bggId);
    const idString = bggIds.map(id => `"${id}"`).join(' ');

    // --- PASS 1: Primary Search (BGG ID) ---
    const primaryQuery = `
      PREFIX wdt: <http://www.wikidata.org/prop/direct/>
      PREFIX wd: <http://www.wikidata.org/entity/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

      SELECT 
        ?bggId ?game ?gameLabel ?image ?website ?minPlayers ?maxPlayers ?minAge ?pubDate ?playTime
        ?designerLabel ?publisherLabel ?illustratorLabel ?genreLabel ?seriesLabel
      WHERE {
        VALUES ?bggId { ${idString} }
        ?game wdt:P2339 ?bggId .
        
        OPTIONAL { ?game rdfs:label ?gameLabel. FILTER(LANG(?gameLabel) = "en") }
        OPTIONAL { ?game wdt:P18 ?image . }
        OPTIONAL { ?game wdt:P856 ?website . }
        OPTIONAL { ?game wdt:P1872 ?minPlayers . }
        OPTIONAL { ?game wdt:P1873 ?maxPlayers . }
        OPTIONAL { ?game wdt:P2047 ?playTime . }
        OPTIONAL { ?game wdt:P2898 ?minAge . }
        OPTIONAL { ?game wdt:P577 ?pubDate . }
        
        OPTIONAL { ?game wdt:P287 ?designer. ?designer rdfs:label ?designerLabel. FILTER(LANG(?designerLabel) = "en") }
        OPTIONAL { ?game wdt:P123 ?publisher. ?publisher rdfs:label ?publisherLabel. FILTER(LANG(?publisherLabel) = "en") }
        OPTIONAL { ?game wdt:P110 ?illustrator. ?illustrator rdfs:label ?illustratorLabel. FILTER(LANG(?illustratorLabel) = "en") }
        OPTIONAL { ?game wdt:P136 ?genre. ?genre rdfs:label ?genreLabel. FILTER(LANG(?genreLabel) = "en") }
        OPTIONAL { ?game wdt:P179 ?series. ?series rdfs:label ?seriesLabel. FILTER(LANG(?seriesLabel) = "en") }
      }
    `;

    try {
      const primaryResults = await executeSparql(primaryQuery);
      finalResults = [...primaryResults];

      // --- PASS 2: Fallback Search (Name-Based) ---
      const foundBggIds = new Set(primaryResults.map((r: any) => r.bggId.value));
      const missingRows = rowsWithIds.filter(r => !foundBggIds.has(r.bggId));

      if (missingRows.length > 0 && missingRows.length < 5) { // Only do name fallback for small missing sets to avoid bloat
        log(`[Batch ${batchIndex}] Pass 1 failed for ${missingRows.length} games. Attempting Name-based Fallback...`);
        
        for (const row of missingRows) {
          const title = row.name || row.boardgame;
          if (!title) continue;
          const cleanTitle = title.trim();
          
          const fallbackQuery = `
            PREFIX wdt: <http://www.wikidata.org/prop/direct/>
            PREFIX wd: <http://www.wikidata.org/entity/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

            SELECT 
              ?game ?gameLabel ?image ?website ?minPlayers ?maxPlayers ?playTime ?minAge ?pubDate
              ?designerLabel ?publisherLabel ?illustratorLabel ?genreLabel ?seriesLabel
            WHERE {
              { ?game rdfs:label "${cleanTitle.replace(/"/g, '\\"')}"@en . }
              UNION
              { ?game skos:altLabel "${cleanTitle.replace(/"/g, '\\"')}"@en . }
              
              # Instead of a strict type, require at least one board game property
              { ?game wdt:P2339 ?anyBggId } UNION
              { ?game wdt:P1872 ?anyMinPlayers } UNION
              { ?game wdt:P287 ?anyDesigner }
              
              OPTIONAL { ?game rdfs:label ?gameLabel. FILTER(LANG(?gameLabel) = "en") }
              # Fallback label if English is missing
              OPTIONAL { ?game rdfs:label ?anyLabel. }
              
              OPTIONAL { ?game wdt:P18 ?image . }
              OPTIONAL { ?game wdt:P856 ?website . }
              OPTIONAL { ?game wdt:P1872 ?minPlayers . }
              OPTIONAL { ?game wdt:P1873 ?maxPlayers . }
              OPTIONAL { ?game wdt:P2047 ?playTime . }
              OPTIONAL { ?game wdt:P2898 ?minAge . }
              OPTIONAL { ?game wdt:P577 ?pubDate . }
              
              OPTIONAL { ?game wdt:P287 ?designer. ?designer rdfs:label ?designerLabel. FILTER(LANG(?designerLabel) = "en") }
              OPTIONAL { ?game wdt:P123 ?publisher. ?publisher rdfs:label ?publisherLabel. FILTER(LANG(?publisherLabel) = "en") }
              OPTIONAL { ?game wdt:P110 ?illustrator. ?illustrator rdfs:label ?illustratorLabel. FILTER(LANG(?illustratorLabel) = "en") }
              OPTIONAL { ?game wdt:P136 ?genre. ?genre rdfs:label ?genreLabel. FILTER(LANG(?genreLabel) = "en") }
              OPTIONAL { ?game wdt:P179 ?series. ?series rdfs:label ?seriesLabel. FILTER(LANG(?seriesLabel) = "en") }
            }
          `;
          const fallbackResults = await executeSparql(fallbackQuery);
          if (fallbackResults.length > 0) {
            log(`[Batch ${batchIndex}] Name fallback SUCCESS for "${title}"`);
            // Manually inject bggId for the grouping logic
            fallbackResults.forEach((r: any) => {
              r.bggId = { value: row.bggId };
            });
            finalResults = [...finalResults, ...fallbackResults];
          } else {
            log(`[Batch ${batchIndex}] Name fallback FAILED for "${title}"`);
          }
        }
      }

      log(`[Batch ${batchIndex}] Total raw rows collected: ${finalResults.length}`);
      if (finalResults.length === 0) return;

      // Grouping logic in memory
      const gameDataMap = new Map<string, any>();

      finalResults.forEach((r: any) => {
        const bggId = r.bggId.value;
        const wikidataId = r.game.value.split('/entity/')[1];
        
        if (!gameDataMap.has(wikidataId)) {
          const title = r.gameLabel ? r.gameLabel.value : (r.anyLabel ? r.anyLabel.value : "Unknown Title");
          const { coverImage, bannerImage, bannerStyles } = processImage(r.image ? r.image.value : null, title);
          
          let publishingYear = null;
          if (r.pubDate) {
            const dateString = r.pubDate.value;
            const yearMatch = dateString.match(/^\d{4}/);
            if (yearMatch) publishingYear = parseInt(yearMatch[0]);
          }

          gameDataMap.set(wikidataId, {
            title,
            wikidataId,
            bggId,
            coverImage,
            bannerImage,
            bannerStyles,
            website: r.website ? r.website.value : null,
            playTime: r.playTime ? parseInt(r.playTime.value) : null,
            minPlayers: r.minPlayers ? parseInt(r.minPlayers.value) : null,
            maxPlayers: r.maxPlayers ? parseInt(r.maxPlayers.value) : null,
            minAge: r.minAge ? parseInt(r.minAge.value) : null,
            publishingYear,
            designers: new Set<string>(),
            publishers: new Set<string>(),
            illustrators: new Set<string>(),
            genres: new Set<string>(),
            series: new Set<string>(),
          });
        }

        const g = gameDataMap.get(wikidataId);
        if (r.designerLabel) g.designers.add(r.designerLabel.value);
        if (r.publisherLabel) g.publishers.add(r.publisherLabel.value);
        if (r.illustratorLabel) g.illustrators.add(r.illustratorLabel.value);
        if (r.genreLabel) g.genres.add(r.genreLabel.value);
        if (r.seriesLabel) g.series.add(r.seriesLabel.value);
      });

      const batch = writeBatch(db);
      gameDataMap.forEach((game) => {
        const publishers = Array.from(game.publishers);
        const finalData = {
          ...game,
          name_lowercase: game.title.toLowerCase(),
          designers: Array.from(game.designers),
          publishers,
          illustrators: Array.from(game.illustrators),
          genres: Array.from(game.genres),
          series: Array.from(game.series),
          publisher: publishers[0] || "Unknown Publisher",
          description: "Full metadata imported from Wikidata.",
          hasHighResArt: false,
          isApproved: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          trending: false,
          imageProcessed: true,
          processedAt: new Date().toISOString()
        };

        const gameId = game.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const docRef = doc(db, 'games', gameId);
        batch.set(docRef, finalData, { merge: true });
        log(`[Batch ${batchIndex}] Mapping: ${game.title} -> ${gameId}`);
      });

      await batch.commit();
      log(`[Batch ${batchIndex}] Committed ${gameDataMap.size} games to Firestore.`);
    } catch (error: any) {
      log(`[Batch ${batchIndex}] Error in batch: ${error.message}`);
    }
  }

  // Split missingQueue into chunks of size BATCH_SIZE
  const chunks = [];
  for (let i = 0; i < missingQueue.length; i += BATCH_SIZE) {
    chunks.push(missingQueue.slice(i, i + BATCH_SIZE));
  }

  // Process chunks with limited concurrency
  log(`🚀 Processing ${chunks.length} batches with concurrency level ${CONCURRENCY}...`);
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const pool = chunks.slice(i, i + CONCURRENCY).map((chunk, j) => 
      processBatch(chunk, i + j + 1, chunks.length)
    );
    await Promise.all(pool);
    
    if (i + CONCURRENCY < chunks.length) {
      log(`Sleeping for 2s to respect rate limits...`);
      await sleep(2000);
    }
  }

  log("🏁 All batches complete.");
}

runImporter().catch(console.error);
