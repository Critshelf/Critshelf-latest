import { initializeApp } from 'firebase/app';
import { getFirestore, writeBatch, doc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Load configuration
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";

const query = `
SELECT ?item ?itemLabel ?itemDescription ?image ?minPlayers ?maxPlayers ?minAge ?pubDate WHERE {
  { ?item wdt:P31 wd:Q131436. } UNION { ?item wdt:P31 wd:Q10811220. }
  ?item wdt:P577 ?pubDate.
  FILTER(?pubDate >= "2024-09-01T00:00:00Z"^^xsd:dateTime)
  OPTIONAL { ?item wdt:P18 ?image. }
  OPTIONAL { ?item wdt:P1872 ?minPlayers. }
  OPTIONAL { ?item wdt:P1873 ?maxPlayers. }
  OPTIONAL { ?item wdt:P2898 ?minAge. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
}
ORDER BY DESC(?pubDate)
`;

async function fetchFromWikidata(sparql: string) {
  console.log("🔍 Querying Wikidata SPARQL endpoint...");
  const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(sparql)}`;
  
  const response = await fetch(url, {
    headers: {
      "Accept": "application/sparql-results+json",
      "User-Agent": "CritShelfDataFetcher/1.0 (https://github.com/CritShelf; coreykern2040@gmail.com)"
    }
  });

  if (!response.ok) {
    throw new Error(`Wikidata error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.results.bindings;
}

function extractId(uri: string) {
  return uri.split('/').pop() || "";
}

async function main() {
  console.log("🚀 Starting Wikidata Board Game Fetcher...");
  
  try {
    const results = await fetchFromWikidata(query);
    console.log(`Found ${results.length} potential games.`);

    if (results.length === 0) {
      console.log("No new games found. Exiting.");
      return;
    }

    const batchSize = 500;
    let currentBatchCount = 0;
    let batch = writeBatch(db);
    let totalImported = 0;

    for (const result of results) {
      const qid = extractId(result.item.value);
      const title = result.itemLabel ? result.itemLabel.value : "Unknown Game";
      
      // Map to Firestore schema
      const gameData = {
        title: title,
        name_lowercase: title.toLowerCase(),
        description: result.itemDescription ? result.itemDescription.value : "",
        coverImage: result.image ? result.image.value : "",
        thumbnail: result.image ? result.image.value : "", // Wikidata usually has one high-res image
        minPlayers: result.minPlayers ? parseInt(result.minPlayers.value) : 1,
        maxPlayers: result.maxPlayers ? parseInt(result.maxPlayers.value) : 0,
        minAge: result.minAge ? parseInt(result.minAge.value) : 0,
        playTime: "0", // Wikidata rarely has playtime stats
        rating: 0,
        isApproved: true,
        wikidataId: qid,
        updatedAt: new Date().toISOString(),
        publicationDate: result.pubDate ? result.pubDate.value : ""
      };

      const docRef = doc(db, 'games', qid);
      batch.set(docRef, gameData, { merge: true });
      currentBatchCount++;
      totalImported++;

      if (currentBatchCount >= batchSize) {
        console.log(`Committing batch of ${currentBatchCount}...`);
        await batch.commit();
        batch = writeBatch(db);
        currentBatchCount = 0;
      }
    }

    if (currentBatchCount > 0) {
      console.log(`Committing final batch of ${currentBatchCount}...`);
      await batch.commit();
    }

    console.log(`\n🏁 Done! Successfully imported/updated ${totalImported} games.`);

  } catch (error) {
    console.error("Fatal error:", error);
  }
}

main().catch(console.error);
