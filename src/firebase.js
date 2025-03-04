// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCvyCmniSxebwyv4sTdYiLrTOZ3RbL99fo",
  authDomain: "rat-chat-app.firebaseapp.com",
  projectId: "rat-chat-app",
  storageBucket: "rat-chat-app.firebasestorage.app",
  messagingSenderId: "160718809223",
  appId: "1:160718809223:web:20f54c73203e9336b47022",
  measurementId: "G-BZQEVV78NP",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
