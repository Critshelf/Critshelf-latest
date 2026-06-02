import { db } from "../lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { Game } from "../components/GameCard";

const WIKIDATA_SEARCH_URL =
  "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${query}&language=en&format=json&origin=*";
const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";

export interface WikidataSearchResult {
  id: string;
  label: string;
  description?: string;
  isWikidataItem: true;
}

export async function searchWikidata(
  query: string,
): Promise<WikidataSearchResult[]> {
  if (!query || query.length < 3) return [];

  const sparqlQuery = `
    SELECT DISTINCT ?item ?itemLabel ?itemDescription WHERE {
      SERVICE wikibase:mwapi {
          bd:serviceParam wikibase:api "EntitySearch" .
          bd:serviceParam wikibase:endpoint "www.wikidata.org" .
          bd:serviceParam mwapi:search "${query.replace(/"/g, '\\"')}" .
          bd:serviceParam mwapi:language "en" .
          ?item wikibase:apiOutputItem mwapi:item .
          ?num wikibase:apiOrdinal mwapi:ordinal .
      }
      
      # Strict Tabletop Filtering: Must be a board game, tabletop game, card game, RPG, or expansion
      ?item wdt:P31/wdt:P279* ?type.
      FILTER(?type IN (wd:Q131436, wd:Q1058221, wd:Q3244175, wd:Q142717, wd:Q150346, wd:Q17277888, wd:Q17154230, wd:Q60474521))
      
      # Strict Exclusions
      MINUS { ?item wdt:P31/wdt:P279* wd:Q7889. } # Video Game
      MINUS { ?item wdt:P400 ?anyPlatform. }     # Has a video game platform
      MINUS { ?item wdt:P2021 ?anySteam. }       # Has a Steam App ID
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } 
    ORDER BY ?num 
    LIMIT 10
  `;

  try {
    const url = `/api/wikidata/sparql?query=${encodeURIComponent(sparqlQuery)}`;
    const response = await fetch(url);

    if (!response.ok) return [];

    const data = await response.json();
    return data.results.bindings.map((result: any) => ({
      id: result.item.value.split("/entity/")[1],
      label: result.itemLabel.value,
      description: result.itemDescription?.value || "No description provided.",
      isWikidataItem: true,
    }));
  } catch (error) {
    console.error("Wikidata search error:", error);
    return [];
  }
}

export async function importWikidataGameToFirestore(
  qid: string,
): Promise<string> {
  const deterministicId = `wikidata_${qid}`;

  // Check if it already exists in Firestore first
  const existingDoc = await getDoc(doc(db, "games", deterministicId));
  if (existingDoc.exists()) return deterministicId;

  console.log(`🚀 Triggering Just-In-Time Import for Wikidata ID: ${qid}...`);

  const sparqlQuery = `
    SELECT ?title ?description ?minPlayers ?maxPlayers ?minAge ?pubDate ?parentGame ?parentTitle
           (GROUP_CONCAT(DISTINCT ?publisherLabel; separator="|") AS ?publishers)
           (GROUP_CONCAT(DISTINCT ?designerLabel; separator="|") AS ?designers)
           (GROUP_CONCAT(DISTINCT ?genreLabel; separator="|") AS ?genres)
    WHERE {
      BIND(wd:${qid} AS ?item)
      
      # Strict Tabletop Filtering
      ?item wdt:P31/wdt:P279* ?type.
      FILTER(?type IN (wd:Q131436, wd:Q1058221, wd:Q3244175, wd:Q142717, wd:Q150346, wd:Q17277888, wd:Q17154230, wd:Q60474521))
      MINUS { ?item wdt:P31/wdt:P279* wd:Q7889. } # Exclude Video Games
      MINUS { ?item wdt:P400 ?anyPlatform. }     # Exclude anything with a video game platform
      MINUS { ?item wdt:P2021 ?anySteam. }       # Exclude Steam App IDs
      
      ?item rdfs:label ?title.
      FILTER(LANG(?title) = "en")
      
      OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
      OPTIONAL { ?item wdt:P1872 ?minPlayers. }
      OPTIONAL { ?item wdt:P1873 ?maxPlayers. }
      OPTIONAL { ?item wdt:P2898 ?minAge. }
      OPTIONAL { 
        ?item wdt:P577 ?date. 
        BIND(YEAR(?date) AS ?year) 
      }
      
      OPTIONAL { 
        ?item wdt:P8646 ?parentGame. 
        ?parentGame rdfs:label ?parentTitle.
        FILTER(LANG(?parentTitle) = "en")
      }
      
      OPTIONAL { 
        ?item wdt:P123 ?publisher. 
        ?publisher rdfs:label ?publisherLabel. 
        FILTER(LANG(?publisherLabel) = "en") 
      }
      OPTIONAL { 
        ?item wdt:P287 ?designer. 
        ?designer rdfs:label ?designerLabel. 
        FILTER(LANG(?designerLabel) = "en") 
      }
      OPTIONAL { 
        ?item wdt:P136 ?genre. 
        ?genre rdfs:label ?genreLabel. 
        FILTER(LANG(?genreLabel) = "en") 
      }
      # Result of YEAR(?date) is projected here as ?pubDate
      BIND(COALESCE(?year, 0) AS ?pubDate)
    }
    GROUP BY ?title ?description ?minPlayers ?maxPlayers ?minAge ?pubDate ?parentGame ?parentTitle
    LIMIT 1
  `;

  try {
    const url = `/api/wikidata/sparql?query=${encodeURIComponent(sparqlQuery)}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Wikidata SPARQL error (${response.status}):`, errorText);
      throw new Error(
        `Wikidata SPARQL error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    const result = data.results.bindings[0];

    if (!result) {
      console.warn(
        `⚠️ Item ${qid} was rejected by tabletop filters (likely a video game or non-game item).`,
      );
      throw new Error("Game rejected: Does not match tabletop criteria.");
    }

    const title = result.title ? result.title.value : "Unknown Game";
    const description = result.description
      ? result.description.value
      : "No description available from Wikidata.";
    const genres = result.genres?.value ? result.genres.value.split("|") : [];

    const isExpansion = !!result.parentGame;
    const minPlayers = result.minPlayers
      ? parseInt(result.minPlayers.value)
      : 0;
    const maxPlayers = result.maxPlayers
      ? parseInt(result.maxPlayers.value)
      : 0;

    // UI Safety Fallback: Flag if player counts are missing
    const needsVerification = minPlayers === 0 || maxPlayers === 0;

    const gameData: any = {
      title: title,
      name_lowercase: title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      description: description,
      coverImage: "",
      thumbnail: "",
      minPlayers: minPlayers,
      maxPlayers: maxPlayers,
      ageRange: result.minAge ? `${result.minAge.value}+` : "10+",
      playTime: "0",
      rating: 0,
      isApproved: true, // Auto-approve JIT imported games
      isExpansion: isExpansion,
      baseGameId: isExpansion
        ? `wikidata_${result.parentGame.value.split("/entity/")[1]}`
        : null,
      wikidataId: qid,
      publishers: result.publishers?.value
        ? result.publishers.value.split("|")
        : [],
      designers: result.designers?.value
        ? result.designers.value.split("|")
        : [],
      categories: genres,
      publishingYear: result.pubDate ? parseInt(result.pubDate.value) : 0,
      status: "published",
      isVerified: true,
      needsVerification: needsVerification,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isWikidataItem: false,
    };

    await setDoc(doc(db, "games", deterministicId), gameData);
    console.log(
      `✅ JIT Import Complete: ${title} saved with ID ${deterministicId}`,
    );
    return deterministicId;
  } catch (error) {
    console.error("JIT Wikidata Save Error:", error);
    throw error;
  }
}

export async function fetchWikidataExpansions(qid: string): Promise<Game[]> {
  const sparqlQuery = `
    SELECT DISTINCT ?item ?itemLabel WHERE {
      # Strict Tabletop Filtering: Must be a board game, tabletop game, card game, or RPG
      ?item wdt:P31/wdt:P279* ?type.
      FILTER(?type IN (wd:Q131436, wd:Q1058221, wd:Q3244175, wd:Q142717, wd:Q150346, wd:Q17277888, wd:Q17154230, wd:Q60474521))
      
      # Strict Exclusions
      MINUS { ?item wdt:P31/wdt:P279* wd:Q7889. } # Video Game
      MINUS { ?item wdt:P400 ?anyPlatform. }
      MINUS { ?item wdt:P2021 ?anySteam. }
      
      { ?item wdt:P361 wd:${qid} . }
      UNION
      { ?item wdt:P144 wd:${qid} . }
      UNION
      { ?item wdt:P8646 wd:${qid} . }
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 20
  `;

  try {
    const url = `/api/wikidata/sparql?query=${encodeURIComponent(sparqlQuery)}`;
    const response = await fetch(url);

    if (!response.ok) return [];

    const data = await response.json();
    return data.results.bindings.map((result: any) => {
      const expansionId = result.item.value.split("/entity/")[1];
      const title = result.itemLabel.value;
      
      return {
        id: expansionId, // Use raw QID for JIT potential
        title: title,
        coverImage: "",
        thumbnail: "",
        isWikidataItem: true,
        isExpansion: true,
        baseGameId: `wikidata_${qid}`,
      } as Game;
    });
  } catch (error) {
    console.error("Fetch Wikidata Expansions Error:", error);
    return [];
  }
}
