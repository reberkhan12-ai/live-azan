// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// 🔑 Your Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyD78fAWDgjWUK7LWssBlRLNpupMIHNlmzs",
  authDomain: "live-azan-2f67c.firebaseapp.com",
  projectId: "live-azan-2f67c",
  storageBucket: "live-azan-2f67c.appspot.com",
  messagingSenderId: "494329043391",
  appId: "1:494329043391:web:7f7d56491aeb84d9dd290a",
  measurementId: "G-G5HYTBVZC5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider, signInWithPopup, analytics };
