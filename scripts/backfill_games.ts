import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function backfill() {
  console.log('🚀 Starting backfill script...');
  const querySnapshot = await getDocs(collection(db, 'games'));
  const batch = writeBatch(db);
  let count = 0;

  querySnapshot.forEach((document) => {
    const data = document.data();
    const updates: any = {};
    let needsUpdate = false;

    // 1. Ensure isApproved is true for imported games
    if (data.isApproved === undefined) {
      // If it looks like a Wikidata import, approve it
      if (data.wikidataId || data.bggId || data.description === 'Full metadata imported from Wikidata.') {
        updates.isApproved = true;
        needsUpdate = true;
      }
    }

    // 2. Ensure createdAt exists
    if (!data.createdAt) {
      updates.createdAt = data.updatedAt || new Date();
      needsUpdate = true;
    }

    // 3. Ensure array fields are actually arrays (not strings)
    const arrayFields = ['designers', 'publishers', 'illustrators', 'genres', 'series', 'categories'];
    arrayFields.forEach(field => {
      if (data[field] && typeof data[field] === 'string') {
        updates[field] = [data[field]];
        needsUpdate = true;
      }
    });

    // 4. Ensure publishingYear is a number if possible
    if (data.publishingYear && typeof data.publishingYear === 'string') {
      const year = parseInt(data.publishingYear);
      if (!isNaN(year)) {
        updates.publishingYear = year;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      batch.update(doc(db, 'games', document.id), updates);
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log(`✅ Backfilled ${count} games.`);
  } else {
    console.log('✨ No games needed backfilling.');
  }
}

backfill().catch(console.error);
