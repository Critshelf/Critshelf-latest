import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

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
  // Query to fetch both the game details AND its relations in a single call or coordinated sequence
  // But for enrichmentService (which usually handles one game at a time), we'll add the relations query.
  
  const query = `
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

  const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(query)}&format=json`;
  
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

async function fetchGameRelations(wikidataId: string) {
  const query = `
    SELECT DISTINCT ?item ?itemLabel ?type ?image ?bggId ?publisherLabel ?year
    WHERE {
      {
        ?item wdt:P8646 wd:${wikidataId}.
        BIND("expansion" AS ?type)
      } UNION {
        wd:${wikidataId} wdt:P747 ?item.
        BIND("edition" AS ?type)
      } UNION {
        ?item wdt:P629 wd:${wikidataId}.
        BIND("edition" AS ?type)
      }
      
      ?item rdfs:label ?itemLabel.
      FILTER(LANG(?itemLabel) = "en")
      
      OPTIONAL { ?item wdt:P18 ?image. }
      OPTIONAL { ?item wdt:P1591 ?bggId. }
      OPTIONAL { 
        ?item wdt:P123 ?publisher. 
        ?publisher rdfs:label ?publisherLabel. 
        FILTER(LANG(?publisherLabel) = "en") 
      }
      OPTIONAL { ?item wdt:P577 ?date. BIND(YEAR(?date) AS ?year) }
    }
  `;

  const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(query)}&format=json`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'CritShelfDataEnricher/1.0 (coreykern2040@gmail.com)' }
    });
    if (!response.ok) return { expansions: [], editions: [] };
    const data = await response.json();
    const bindings = data.results.bindings;

    const expansions: any[] = [];
    const editions: any[] = [];

    bindings.forEach((b: any) => {
      const item = {
        id: b.item.value.split('/entity/')[1],
        title: b.itemLabel.value,
        boxArtUrl: b.image ? b.image.value : null,
        bggId: b.bggId ? b.bggId.value : null
      };

      if (b.type.value === 'expansion') {
        expansions.push(item);
      } else {
        editions.push({
          ...item,
          publisher: b.publisherLabel ? b.publisherLabel.value : 'Unknown Publisher',
          yearPublished: b.year ? parseInt(b.year.value) : null
        });
      }
    });

    return { expansions, editions };
  } catch (error) {
    return { expansions: [], editions: [] };
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

export async function enrichGames() {
  console.log('Starting game enrichment process...');
  
  const gamesSnapshot = await getDocs(collection(db, 'games'));
  console.log(`Found ${gamesSnapshot.size} games to process.`);

  let enrichedCount = 0;

  for (const doc of gamesSnapshot.docs) {
    const gameData = doc.data();
    const wikidataId = gameData.wikidataId;

    if (!wikidataId || gameData.publishingYear) continue;

    const wikidataResult = await fetchWikidata(wikidataId);
    if (!wikidataResult) {
      await sleep(1000);
      continue;
    }

    const { expansions, editions } = await fetchGameRelations(wikidataId);

    const enrichmentData: any = {
      expansions,
      editions
    };

    if (wikidataResult.year) enrichmentData.publishingYear = parseInt(wikidataResult.year.value);
    if (wikidataResult.publishers?.value) enrichmentData.publishers = wikidataResult.publishers.value.split('|');
    if (wikidataResult.designers?.value) enrichmentData.designers = wikidataResult.designers.value.split('|');
    if (wikidataResult.artists?.value) enrichmentData.artists = wikidataResult.artists.value.split('|');

    let description = null;
    if (wikidataResult.wikipediaUrl) {
      const wikipediaUrl = wikidataResult.wikipediaUrl.value;
      const articleTitle = decodeURIComponent(wikipediaUrl.split('/wiki/')[1]);
      description = await fetchWikipediaDescription(articleTitle);
    }

    if (!description && wikidataResult.wikidataDescription) {
      description = wikidataResult.wikidataDescription.value;
    }

    if (description) enrichmentData.description = description;

    if (Object.keys(enrichmentData).length > 0) {
      await setDoc(doc.ref, enrichmentData, { merge: true });
      enrichedCount++;
    }

    await sleep(1000);
  }

  return { total: gamesSnapshot.size, enriched: enrichedCount };
}
