
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseConfig as configFromModule } from "@/firebase/config";

// Prefer environment variables, but fallback to the hardcoded config if they are missing
const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || configFromModule.projectId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || configFromModule.appId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || configFromModule.storageBucket,
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || configFromModule.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || configFromModule.authDomain,
};

// This function ensures that we initialize the app only once.
const getFirebaseApp = () => {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
};

export const firebaseApp = getFirebaseApp();

// Initialize Firestore with settings to improve connectivity in restricted networks
const db = (() => {
  const app = getFirebaseApp();
  // We use initializeFirestore to enable long-polling, which prevents the 10s timeout error
  return initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
})();

export const getDb = () => db;
export const getAuthInstance = () => getAuth(getFirebaseApp());
