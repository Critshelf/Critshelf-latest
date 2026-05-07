import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Game } from '../components/GameCard';

const WIKIDATA_SEARCH_URL = "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${query}&language=en&format=json&origin=*";
const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";

export interface WikidataSearchResult {
  id: string;
  label: string;
  description?: string;
  isWikidataItem: true;
}

export async function searchWikidata(query: string): Promise<WikidataSearchResult[]> {
  if (!query || query.length < 3) return [];
  
  try {
    const url = `https://www.wikidata.org/w/api.php?origin=*&action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&limit=10&type=item`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.search) return [];
    
    return data.search.map((item: any) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      isWikidataItem: true
    }));
  } catch (error) {
    console.error("Wikidata search error:", error);
    return [];
  }
}

export async function fetchAndSaveWikidataGame(qid: string): Promise<string> {
  // Check if it already exists in Firestore first (double check)
  const existingDoc = await getDoc(doc(db, 'games', qid));
  if (existingDoc.exists()) return qid;

  console.log(`🚀 Fetching full stats for Wikidata ID: ${qid}...`);
  
  const sparqlQuery = `
    SELECT ?item ?itemLabel ?itemDescription ?image ?minPlayers ?maxPlayers ?minAge ?pubDate WHERE {
      BIND(wd:${qid} AS ?item)
      OPTIONAL { ?item wdt:P18 ?image. }
      OPTIONAL { ?item wdt:P1872 ?minPlayers. }
      OPTIONAL { ?item wdt:P1873 ?maxPlayers. }
      OPTIONAL { ?item wdt:P2898 ?minAge. }
      OPTIONAL { ?item wdt:P577 ?pubDate. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    }
    LIMIT 1
  `;

  try {
    const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(sparqlQuery)}`;
    const response = await fetch(url, {
      headers: { "Accept": "application/sparql-results+json" }
    });
    const data = await response.json();
    const result = data.results.bindings[0];

    if (!result) throw new Error("No data found for this QID");

    const title = result.itemLabel ? result.itemLabel.value : "Unknown Game";
    
    const gameData = {
      title: title,
      name_lowercase: title.toLowerCase(),
      description: result.itemDescription ? result.itemDescription.value : "",
      coverImage: result.image ? result.image.value : "",
      thumbnail: result.image ? result.image.value : "",
      minPlayers: result.minPlayers ? parseInt(result.minPlayers.value) : 1,
      maxPlayers: result.maxPlayers ? parseInt(result.maxPlayers.value) : 0,
      minAge: result.minAge ? parseInt(result.minAge.value) : 0,
      playTime: "0",
      rating: 0,
      isApproved: true,
      isExpansion: false,
      baseGameId: null,
      wikidataId: qid,
      updatedAt: new Date().toISOString(),
      publicationDate: result.pubDate ? result.pubDate.value : ""
    };

    await setDoc(doc(db, 'games', qid), gameData);
    console.log(`✅ Successfully saved Wikidata game: ${title}`);
    return qid;
  } catch (error) {
    console.error("JIT Wikidata Save Error:", error);
    throw error;
  }
}
