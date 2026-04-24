import { initializeApp } from 'firebase/app';
import { getFirestore, writeBatch, doc } from 'firebase/firestore';
import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';
import path from 'path';

// Load configuration
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_"
});

// --- MANUAL IDS SECTION ---
// Add any specific BGG IDs you want to force-fetch here
const manualIds: string[] = [
  "404456", // Forest Shuffle
  "342942", // Ark Nova
  "350184", // Cascadia
];
// --------------------------

async function fetchHotness(): Promise<string[]> {
  console.log("🔥 Fetching BGG Hotness list...");
  try {
    const response = await fetch("https://boardgamegeek.com/xmlapi2/hot?type=boardgame");
    const xml = await response.text();
    const data = parser.parse(xml);
    
    if (!data.items?.item) return [];
    
    const items = Array.isArray(data.items.item) ? data.items.item : [data.items.item];
    return items.map((item: any) => item["@_id"]);
  } catch (error) {
    console.error("Error fetching hotness:", error);
    return [];
  }
}

async function fetchGameDetails(ids: string[]): Promise<any[]> {
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(',')}&stats=1`;
  console.log(`📦 Fetching details for ${ids.length} games...`);
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    const data = parser.parse(xml);
    
    if (!data.items?.item) return [];
    
    const items = Array.isArray(data.items.item) ? data.items.item : [data.items.item];
    return items.map((item: any) => {
      // BGG names can be multiple, find the primary
      let title = "";
      if (Array.isArray(item.name)) {
        const primary = item.name.find((n: any) => n["@_type"] === "primary");
        title = primary ? primary["@_value"] : item.name[0]["@_value"];
      } else {
        title = item.name["@_value"];
      }

      // Statistics
      const stats = item.statistics?.ratings;
      const bayesAverage = stats?.bayesaverage?.["@_value"];
      const average = stats?.average?.["@_value"];
      const rating = parseFloat(bayesAverage || average || "0");

      return {
        id: item["@_id"],
        title: title,
        name_lowercase: title.toLowerCase(),
        description: item.description,
        coverImage: item.image,
        thumbnail: item.thumbnail,
        minPlayers: parseInt(item.minplayers?.["@_value"] || "0"),
        maxPlayers: parseInt(item.maxplayers?.["@_value"] || "0"),
        playTime: item.maxplaytime?.["@_value"] || "0", // Map max_playtime to playTime
        minAge: parseInt(item.minage?.["@_value"] || "0"),
        rating: rating,
        isApproved: true, // Auto-approve BGG imports
        bggId: item["@_id"],
        updatedAt: new Date().toISOString()
      };
    });
  } catch (error) {
    console.error("Error fetching details:", error);
    return [];
  }
}

async function main() {
  console.log("🚀 Starting BGG XML API Fetcher...");
  
  const hotIds = await fetchHotness();
  const allIds = Array.from(new Set([...hotIds, ...manualIds]));
  
  console.log(`Found ${allIds.length} unique BGG IDs to process.`);
  
  const CHUNK_SIZE = 20;
  const idsToProcess = [...allIds];
  let processedCount = 0;

  while (idsToProcess.length > 0) {
    const chunk = idsToProcess.splice(0, CHUNK_SIZE);
    const games = await fetchGameDetails(chunk);
    
    if (games.length > 0) {
      const batch = writeBatch(db);
      for (const game of games) {
        // Use BGG ID as Doc ID for consistency
        const docRef = doc(db, 'games', game.id);
        batch.set(docRef, game, { merge: true });
      }
      
      await batch.commit();
      processedCount += games.length;
      console.log(`✅ Upserted ${games.length} games. Total: ${processedCount}`);
    }

    if (idsToProcess.length > 0) {
      console.log("⏱️ Waiting 3 seconds (BGG rate limit)...");
      await new Promise(res => setTimeout(res, 3000));
    }
  }

  console.log(`\n🏁 Done! Successfully processed ${processedCount} games.`);
}

main().catch(console.error);
