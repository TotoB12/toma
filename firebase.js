// firebase.js
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from 'firebase/database'; // Import Realtime Database

const firebaseConfig = {
  apiKey: "AIzaSyAOJHjrK-tn7_LfWXtrkBApkRMFnIkJYG8",
  authDomain: "toma-totob12.firebaseapp.com",
  projectId: "toma-totob12",
  storageBucket: "toma-totob12.appspot.com",
  messagingSenderId: "184718671115",
  appId: "1:184718671115:web:32bfd8f90791aef0dcf60e",
  measurementId: "G-E35DS55TBR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// Initialize Realtime Database
const database = getDatabase(app);

export { auth, database, firebaseConfig };
