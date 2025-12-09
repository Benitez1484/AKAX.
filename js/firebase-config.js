// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, where, doc, updateDoc, deleteDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDyNTsiAJ8JuwcNRj2ufK-qCS3ui_q0zuU",
  authDomain: "hongos-ostras.firebaseapp.com",
  projectId: "hongos-ostras",
  storageBucket: "hongos-ostras.firebasestorage.app",
  messagingSenderId: "206063525437",
  appId: "1:206063525437:web:c2340cdc47d85238cd9454",
  measurementId: "G-VYDWNRYFFF"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('✅ Firebase inicializado correctamente');

// ✅ AQUI AGREGUÉ "limit" QUE FALTABA
export { 
  db, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  where, 
  doc, 
  updateDoc, 
  deleteDoc,
  Timestamp 
};