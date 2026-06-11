import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, updatePassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection as firestoreCollection, doc as firestoreDoc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, limit, writeBatch, increment, arrayUnion, arrayRemove, runTransaction } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";
import { state } from './state.js';
import { expandFirestorePath, resolveFirestorePath } from './tenantPaths.js';

const firebaseConfig = {
  apiKey: "AIzaSyDGucpjrJ58MXNr947a6wqvVxxxo_5TFKg",
  authDomain: "edumanage-sms-2026.firebaseapp.com",
  projectId: "edumanage-sms-2026",
  storageBucket: "edumanage-sms-2026.appspot.com",
  messagingSenderId: "317801771239",
  appId: "1:317801771239:web:872909d14c8ea564053242"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

function tenantPathSegments(segments) {
  return resolveFirestorePath(segments, state.tenantId);
}

function collection(parent, ...segments) {
  if (parent === db) return firestoreCollection(db, ...tenantPathSegments(segments));
  return firestoreCollection(parent, ...segments);
}

function doc(parent, ...segments) {
  if (parent === db) return firestoreDoc(db, ...tenantPathSegments(segments));
  return firestoreDoc(parent, ...segments);
}

function rootCollection(...segments) {
  return firestoreCollection(db, ...expandFirestorePath(segments));
}

function rootDoc(...segments) {
  return firestoreDoc(db, ...expandFirestorePath(segments));
}

export {
  auth, db, storage, googleProvider, firebaseConfig, initializeApp, getAuth,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updatePassword, sendPasswordResetEmail,
  signInWithPopup, signOut, onAuthStateChanged,
  collection, doc, rootCollection, rootDoc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, query, where, orderBy,
  onSnapshot, serverTimestamp, limit, writeBatch, runTransaction, increment, arrayUnion, arrayRemove,
  ref, uploadBytes, getDownloadURL
};
