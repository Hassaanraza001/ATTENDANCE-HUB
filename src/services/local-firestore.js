// Is file ka kaam Electron ke main process ke liye Firebase se data laana hai.
// Yah 'firebase-admin' ka istemaal karta hai, jo backend/server environment ke liye hai.

// **NOTE: THIS FILE IS NO LONGER USED FOR SMS FUNCTIONALITY.**
// The data fetching logic has been moved to the frontend (page.tsx) to
// resolve permission issues and simplify the architecture. This file is kept
// for potential future backend tasks but is not actively used by main.js for sending SMS.

const admin = require('firebase-admin');
const path = require('path');
const { app } = require('electron');

const isPackaged = app.isPackaged; 

const SERVICE_ACCOUNT_KEY_PATH = isPackaged
  ? path.join(process.resourcesPath, 'serviceAccountKey.json')
  : path.join(process.cwd(), 'serviceAccountKey.json');

try {
    const serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);
    
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("Firebase Admin SDK initialized successfully.");
    }
} catch (error) {
    console.error("CRITICAL ERROR: Could not initialize Firebase Admin SDK.");
    console.error(`Error details: ${error.message}`);
    console.error(`Attempted to load key from: ${SERVICE_ACCOUNT_KEY_PATH}`);
    throw new Error("serviceAccountKey.json not found or invalid.");
}

const db = admin.firestore();

// The functions below are no longer called by main.js for the SMS feature.

async function getStudentsForSms(className, dateKey, userId) {
  // This function is deprecated for SMS sending.
  return { students: [], presentCount: 0, totalStudents: 0 };
}

async function getFacultiesForSms(userId) {
    // This function is deprecated for SMS sending.
    return [];
}

module.exports = { getStudentsForSms, getFacultiesForSms };
