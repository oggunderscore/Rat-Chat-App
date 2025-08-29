// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:123456789:web:demo",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-DEMO",
};

// Check if we're using demo configuration
if (firebaseConfig.apiKey === "demo-api-key") {
  console.warn("⚠️  Using demo Firebase configuration. Please set up your .env file with real Firebase credentials.");
  console.warn("📝 Check the .env.example file for the required format.");
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app);

export { app, db, auth, functions };
