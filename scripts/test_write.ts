import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
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

async function testWrite() {
  try {
    await setDoc(doc(db, 'test', 'write-test'), {
      timestamp: new Date().toISOString(),
      message: 'Hello from script'
    });
    console.log('Write successful!');
  } catch (error) {
    console.error('Write failed:', error);
  }
}

testWrite().catch(console.error);
