import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, query, where, limit } from 'firebase/firestore';
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

const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';
const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/w/api.php';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWikidata(wikidataId: string) {
  const queryStr = `
    SELECT ?year (GROUP_CONCAT(DISTINCT ?publisherLabel; separator="|") AS ?publishers) 
           (GROUP_CONCAT(DISTINCT ?designerLabel; separator="|") AS ?designers) 
           (GROUP_CONCAT(DISTINCT ?artistLabel; separator="|") AS ?artists) 
           ?wikipediaUrl ?wikidataDescription
    WHERE {
      BIND(wd:${wikidataId} AS ?game)
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
      OPTIONAL { 
        ?game schema:description ?wikidataDescription. 
        FILTER(LANG(?wikidataDescription) = "en") 
      }
    }
    GROUP BY ?year ?wikipediaUrl ?wikidataDescription
    LIMIT 1
  `;

  const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(queryStr)}&format=json`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'CritShelfDataEnricher/1.0 (coreykern2040@gmail.com)' }
    });
    if (!response.ok) throw new Error(`Wikidata error: ${response.statusText}`);
    const data = await response.json();
    return data.results.bindings[0];
  } catch (error) {
    console.error(`Error fetching Wikidata for ${wikidataId}:`, error);
    return null;
  }
}

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
    if (!response.ok) throw new Error(`Wikipedia error: ${response.statusText}`);
    const data = await response.json();
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    return pages[pageId].extract || null;
  } catch (error) {
    console.error(`Error fetching Wikipedia for ${articleTitle}:`, error);
    return null;
  }
}

async function enrichGames() {
  console.log('Starting game enrichment process...');
  
  const gamesSnapshot = await getDocs(collection(db, 'games'));
  console.log(`Found ${gamesSnapshot.size} total games in Firestore.`);

  let processedCount = 0;
  let enrichedCount = 0;
  let skippedCount = 0;

  for (const doc of gamesSnapshot.docs) {
    const gameData = doc.data();
    const wikidataId = gameData.wikidataId as string;

    if (!wikidataId || gameData.publishingYear !== undefined) {
      skippedCount++;
      continue;
    }

    console.log(`Processing: ${gameData.title} (${wikidataId})...`);

    const wikidataResult = await fetchWikidata(wikidataId);
    
    if (!wikidataResult) {
      console.log(`No Wikidata results for ${wikidataId}`);
      // Mark as processed with a placeholder to avoid re-fetching
      await setDoc(doc.ref, { publishingYear: 0 }, { merge: true });
      await sleep(1000);
      continue;
    }

    const enrichmentData: any = {};

    // Parse Wikidata results
    if (wikidataResult.year) {
      enrichmentData.publishingYear = parseInt(wikidataResult.year.value);
    } else {
      enrichmentData.publishingYear = 0; 
    }

    if (wikidataResult.publishers?.value) {
      enrichmentData.publishers = wikidataResult.publishers.value.split('|');
    }
    if (wikidataResult.designers?.value) {
      enrichmentData.designers = wikidataResult.designers.value.split('|');
    }
    if (wikidataResult.artists?.value) {
      enrichmentData.artists = wikidataResult.artists.value.split('|');
    }

    // Handle Description (Wikipedia or Wikidata fallback)
    let description = null;
    if (wikidataResult.wikipediaUrl) {
      const wikipediaUrl = wikidataResult.wikipediaUrl.value;
      const articleTitle = decodeURIComponent(wikipediaUrl.split('/wiki/')[1]);
      console.log(`Fetching Wikipedia description for: ${articleTitle}`);
      description = await fetchWikipediaDescription(articleTitle);
    }

    if (!description && wikidataResult.wikidataDescription) {
      description = wikidataResult.wikidataDescription.value;
    }

    if (description) {
      enrichmentData.description = description;
    }

    // Firestore Merge
    await setDoc(doc.ref, enrichmentData, { merge: true });
    console.log(`Successfully enriched ${gameData.title}`);
    
    enrichedCount++;
    processedCount++;

    // Respect rate limits only when we actually did work
    await sleep(2000);
    
    // Safety break to avoid total timeout if we've done a lot of work
    if (processedCount >= 50) {
      console.log('Reached batch limit of 50 enrichments. Stopping to avoid timeout.');
      break;
    }
  }

  console.log(`Enrichment summary: Enriched: ${enrichedCount}, Skipped: ${skippedCount}`);
}

enrichGames().catch(err => {
  console.error('Fatal error in enrichment script:', err);
  process.exit(1);
});
