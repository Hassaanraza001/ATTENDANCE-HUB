
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
};

// This function ensures that we initialize the app only once.
const getFirebaseApp = () => {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
};

// Export functions to get the services. This allows for lazy initialization.
// We also export the initialization check for debugging.
export const getDb = () => getFirestore(getFirebaseApp());
export const getAuthInstance = () => getAuth(getFirebaseApp());
export const firebaseApp = getFirebaseApp();
