import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
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
const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWikipediaDescription(articleTitle: string) {
  try {
    const response = await fetch(`${WIKIPEDIA_API_URL}${encodeURIComponent(articleTitle)}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.extract || null;
  } catch (error) {
    return null;
  }
}

async function runUnifiedPipeline() {
  console.log('\x1b[36m%s\x1b[0m', '🚀 Starting Unified CritShelf Import Pipeline...');

  const sparqlQuery = `
    SELECT ?game ?gameLabel ?year 
           (GROUP_CONCAT(DISTINCT ?publisherLabel; separator="|") AS ?publishers) 
           (GROUP_CONCAT(DISTINCT ?designerLabel; separator="|") AS ?designers) 
           (GROUP_CONCAT(DISTINCT ?artistLabel; separator="|") AS ?artists) 
           ?wikipediaUrl ?wikidataDescription
    WHERE {
      ?game wdt:P31 wd:Q131436. # Instance of board game
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      
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
    GROUP BY ?game ?gameLabel ?year ?wikipediaUrl ?wikidataDescription
    ORDER BY DESC(?year)
    LIMIT 50
  `;

  const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(sparqlQuery)}&format=json`;
  
  let results = [];
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'CritShelfUnifiedPipeline/1.0 (coreykern2040@gmail.com)' }
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

  for (const result of results) {
    const wikidataUrl = result.game.value;
    const wikidataId = wikidataUrl.split('/entity/')[1];
    const title = result.gameLabel.value;
    const gameId = title.toLowerCase().replace(/[^a-z0-9]/g, '-');

    try {
      console.log(`Processing: ${title} (${wikidataId})...`);

      const gameData: any = {
        title: title,
        wikidataId: wikidataId,
        updatedAt: serverTimestamp(),
        trending: false, // Default
        coverImage: `https://picsum.photos/seed/${gameId}/800/1200`, // Placeholder
        playTime: "60-120 min", // Default if not in Wikidata
        playerCount: "2-4 Players", // Default
      };

      // Metadata from Wikidata
      if (result.year) gameData.publishingYear = parseInt(result.year.value);
      if (result.publishers?.value) gameData.publishers = result.publishers.value.split('|');
      if (result.designers?.value) gameData.designers = result.designers.value.split('|');
      if (result.artists?.value) gameData.artists = result.artists.value.split('|');

      // Description Logic
      let description = "";
      if (result.wikipediaUrl) {
        const wikipediaUrl = result.wikipediaUrl.value;
        const articleTitle = decodeURIComponent(wikipediaUrl.split('/wiki/')[1]);
        
        // Try Wikipedia API
        const wikiDesc = await fetchWikipediaDescription(articleTitle);
        if (wikiDesc) {
          description = wikiDesc;
        }
      }

      // Fallback to Wikidata description
      if (!description && result.wikidataDescription) {
        description = result.wikidataDescription.value;
      }

      gameData.description = description || "No description available.";

      // Firestore Write
      await setDoc(doc(db, 'games', gameId), gameData, { merge: true });
      
      console.log('\x1b[32m%s\x1b[0m', `✅ Success: ${title}`);
      successCount++;

      // Rate limiting delay
      await sleep(1000);

    } catch (error) {
      console.error('\x1b[31m%s\x1b[0m', `❌ Error processing ${wikidataId} (${title}):`, error);
      failCount++;
      // Continue to next game
      continue;
    }
  }

  console.log('\x1b[36m%s\x1b[0m', '-----------------------------------');
  console.log('\x1b[36m%s\x1b[0m', `🏁 Pipeline Finished!`);
  console.log('\x1b[32m%s\x1b[0m', `✅ Successful: ${successCount}`);
  console.log('\x1b[31m%s\x1b[0m', `❌ Failed: ${failCount}`);
}

runUnifiedPipeline().catch(err => {
  console.error('Unexpected pipeline crash:', err);
  process.exit(1);
});
