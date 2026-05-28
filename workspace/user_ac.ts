import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { calculateBaseDC } from './src/lib/dcUtils.js';

// No, wait, I can just write a script that accesses firebase from firebase-applet-config.json
