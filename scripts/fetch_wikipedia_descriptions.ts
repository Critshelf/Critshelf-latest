import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function searchWikipedia(query: string): Promise<string | null> {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&origin=*`;
  
  try {
    const response = await fetch(searchUrl);
    const data = await response.json();
    const results = data.query?.search;
    
    if (results && results.length > 0) {
      // Return the title of the first result
      return results[0].title;
    }
  } catch (error) {
    console.error(`Search error for ${query}:`, error);
  }
  return null;
}

async function fetchWikipediaDescription(title: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(title)}&origin=*`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    const pages = data.query?.pages;
    if (!pages) return null;
    
    const pageId = Object.keys(pages)[0];
    if (pageId === '-1') return null;
    
    return pages[pageId].extract || null;
  } catch (error) {
    console.error(`Fetch error for ${title}:`, error);
    return null;
  }
}

async function main() {
  console.log("Starting Wikipedia Description Fetcher (V2)...");
  
  const gamesSnap = await getDocs(collection(db, 'games'));
  const allGames = gamesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  
  const missingGames = allGames.filter((g: any) => !g.description || g.description.trim() === "");
  console.log(`Found ${missingGames.length} games with missing descriptions.`);
  
  if (missingGames.length === 0) return;

  let successCount = 0;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const game of missingGames) {
    console.log(`\nProcessing: ${game.title}`);
    
    // Step 1: Search for the title
    let wikiTitle = await searchWikipedia(game.title);
    await new Promise(r => setTimeout(r, 300));

    // If direct search fails, try adding "board game" to the query
    if (!wikiTitle) {
      wikiTitle = await searchWikipedia(`${game.title} board game`);
      await new Promise(r => setTimeout(r, 300));
    }

    if (wikiTitle) {
      console.log(`Found Wiki page: ${wikiTitle}`);
      const description = await fetchWikipediaDescription(wikiTitle);
      
      if (description && description.length > 100) { // Safety check for valid summary
        batch.update(doc(db, 'games', game.id), { description });
        successCount++;
        batchCount++;
        console.log(`✅ Success!`);
        
        if (batchCount >= 500) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      } else {
        console.log(`❌ Page description too short or empty.`);
      }
    } else {
      console.log(`❌ No Wikipedia result for "${game.title}"`);
    }
    
    // Global rate limit delay
    await new Promise(r => setTimeout(r, 500));
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log("\n--- Final Summary ---");
  console.log(`Games matched: ${successCount} / ${missingGames.length}`);
}

main().catch(console.error);
