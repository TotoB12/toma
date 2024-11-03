import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import Constants from 'expo-constants';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Firebase config
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

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const database = getFirestore();