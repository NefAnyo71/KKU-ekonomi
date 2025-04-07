import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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
  const config = await getFirebaseConfig();
  app = initializeApp(config);
  db = getFirestore(app);
  analytics = getAnalytics(app);
}