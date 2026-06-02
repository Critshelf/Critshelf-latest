import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, writeBatch, getDocs, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

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

export async function seedGames() {
  const csvPath = path.join(process.cwd(), 'games.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error('games.csv not found');
  }

  const fileContent = fs.readFileSync(csvPath, 'utf8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true
  });

  console.log(`Parsed ${records.length} records from CSV.`);

  let seededCount = 0;
  const batchSize = 100;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = records.slice(i, i + batchSize);

    for (const record of chunk as any[]) {
      // Use record.name (new format) or record.boardgame (old format)
      const title = record.name || record.boardgame;
      if (!title) continue;

      const bggId = record.objectid || 'unknown';
      const gameId = title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, '-');
      const docRef = doc(db, 'games', gameId);
      
      const gameData = {
        title: title,
        bggId: bggId,
        coverImage: `https://picsum.photos/seed/${gameId}/800/1200`,
        playTime: record.max_playtime ? `${record.max_playtime} min` : '60-120 min',
        playerCount: record.min_players ? `${record.min_players}-${record.max_players} Players` : '2-4 Players',
        minPlayers: parseInt(record.min_players || '2'),
        maxPlayers: parseInt(record.max_players || '4'),
        ageRange: record.minimum_age ? `${record.minimum_age}+` : '12+',
        rating: parseFloat(record.avg_rating || '7.5'),
        isApproved: true,
        isExpansion: false,
        baseGameId: null,
        status: 'approved',
        name_lowercase: title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
        trending: true,
        wikidataId: getWikidataId(title),
        createdAt: serverTimestamp()
      };

      batch.set(docRef, gameData, { merge: true });
      seededCount++;
    }

    await batch.commit();
    console.log(`Seeded ${seededCount} games...`);
  }

  return seededCount;
}

function getWikidataId(title: string): string | null {
  const mapping: { [key: string]: string } = {
    'Brass: Birmingham': 'Q56274044',
    'Pandemic Legacy: Season 1': 'Q21152205',
    'Ark Nova': 'Q108817453',
    'Gloomhaven': 'Q29043132',
    'Twilight Imperium: Fourth Edition': 'Q42553140',
    'Dune: Imperium': 'Q104841961',
    'Terraforming Mars': 'Q24262272',
    'War of the Ring: Second Edition': 'Q16623194',
    'Star Wars: Rebellion': 'Q22674223',
    'Spirit Island': 'Q30602047'
  };
  return mapping[title] || null;
}
