import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

let app;
let db;
let analytics;

async function getFirebaseConfig() {
  const response = await fetch('https://proxyserver-flax.vercel.app/api/config', {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    mode: 'cors'
  });

  if (!response.ok) throw new Error(`Config fetch failed: ${response.status}`);

  const data = await response.json();
  if (data.status !== 'success' || !data.data) throw new Error('Invalid config response');

  return data.data;
}

async function initializeFirebase() {
  try {
    const config = await getFirebaseConfig();
    app = initializeApp(config);
    db = getFirestore(app);
    analytics = getAnalytics(app);
    console.log("Firebase initialized successfully");
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
}

// İletişim formu verilerini kaydetme fonksiyonu
async function saveContactForm(data) {
  try {
    if (!db) await initializeFirebase();
    
    const docRef = await addDoc(collection(db, "internetsitesi"), {
      name: data.name,
      phone: data.phone,
      subject: data.subject,
      email: data.email,
      message: data.message,
      timestamp: new Date()
    });
    
    console.log("Document written with ID: ", docRef.id);
    return true;
  } catch (error) {
    console.error("Error adding document: ", error);
    return false;
  }
}

export { initializeFirebase, saveContactForm };