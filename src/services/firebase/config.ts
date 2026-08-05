import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

// Environment variable configuration for GitHub Pages / Vite environment
const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDjP4fpjUgW5ftp3m1YjmPTvuDKSW9ZsXY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "liquid-doodad-4zp2g.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "liquid-doodad-4zp2g",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:117057487585:web:68de5c25aabbfc3c76eda0",
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-despensastock-6c9133a4-6db3-4fc7-a728-d7b9304bd803",
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
  ? firebaseConfig.firestoreDatabaseId 
  : undefined;

let db: Firestore;
try {
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }, dbId || '(default)');
} catch (e) {
  console.warn('initializeFirestore fallback to getFirestore:', e);
  db = dbId ? getFirestore(app, dbId) : getFirestore(app);
}

export { app, db, firebaseConfig };


