import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Try default initialization (should use environment project)
admin.initializeApp();
const db = getFirestore();

async function testAdmin() {
  try {
    const collections = await db.listCollections();
    console.log('Successfully listed collections:', collections.map(c => c.id));
    
    await db.collection('test').doc('admin-test').set({
      timestamp: new Date().toISOString(),
      message: 'Hello from Admin'
    });
    console.log('Admin write successful!');
  } catch (error: any) {
    console.error('Admin test failed:', error.message);
  }
}

testAdmin().catch(console.error);
