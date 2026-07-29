import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import appletConfigJson from '../../../firebase-applet-config.json';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

// 1. Start with values from firebase-applet-config.json or environment variables
let firebaseConfig: FirebaseConfig = {
  apiKey: appletConfigJson?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: appletConfigJson?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: appletConfigJson?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || 'liquid-doodad-4zp2g',
  storageBucket: appletConfigJson?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: appletConfigJson?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: appletConfigJson?.appId || import.meta.env.VITE_FIREBASE_APP_ID || '',
  firestoreDatabaseId: appletConfigJson?.firestoreDatabaseId || import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || 'ai-studio-despensastock-6c9133a4-6db3-4fc7-a728-d7b9304bd803',
};

// Fallback safety credentials if running without backend config initially
if (!firebaseConfig.apiKey) {
  firebaseConfig.apiKey = "AIzaSyDjP4fpjUgW5ftp3m1YjmPTvuDKSW9ZsXY";
  firebaseConfig.projectId = "liquid-doodad-4zp2g";
  firebaseConfig.authDomain = "liquid-doodad-4zp2g.firebaseapp.com";
  firebaseConfig.appId = "1:117057487585:web:68de5c25aabbfc3c76eda0";
  firebaseConfig.firestoreDatabaseId = "ai-studio-despensastock-6c9133a4-6db3-4fc7-a728-d7b9304bd803";
}

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
  ? firebaseConfig.firestoreDatabaseId 
  : undefined;

const db: Firestore = dbId ? getFirestore(app, dbId) : getFirestore(app);

export { app, db, firebaseConfig };
