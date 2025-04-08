import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Firebase bağlantı durumu için değişkenler
let app;
let db;
let analytics;
let isInitialized = false;

// Proxy sunucu URL'si
const PROXY_SERVER_URL = 'https://proxyserver-flax.vercel.app';

// Firebase başlatma fonksiyonu
async function initializeFirebase() {
  if (isInitialized) return;

  try {
    // Proxy üzerinden config al
    const config = await fetchFirebaseConfig();
    
    // Firebase'i başlat
    app = initializeApp(config);
    db = getFirestore(app);
    
    // Analytics sadece destekleniyorsa başlat
    if (await isSupported()) {
      analytics = getAnalytics(app);
    }
    
    isInitialized = true;
    console.log("Firebase başarıyla başlatıldı");
  } catch (error) {
    console.error("Firebase başlatma hatası:", error);
    throw error;
  }
}

// Proxy üzerinden Firebase config alma
async function fetchFirebaseConfig() {
  try {
    const response = await fetch(`${PROXY_SERVER_URL}/api/config`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Config alınamadı: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status !== 'success' || !data.data) {
      throw new Error('Geçersiz config formatı');
    }

    // Gerekli alanları kontrol et
    const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
    const missingFields = requiredFields.filter(field => !data.data[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Eksik alanlar: ${missingFields.join(', ')}`);
    }

    return data.data;
  } catch (error) {
    console.error("Config alma hatası:", error);
    throw error;
  }
}

// Firestore'a veri kaydetme fonksiyonu (DOĞRUDAN Firestore'a yazacak)
async function saveContactForm(data) {
  try {
    if (!isInitialized) {
      await initializeFirebase();
    }

    // Veri doğrulama
    const requiredFields = ['name', 'phone', 'subject', 'email', 'message'];
    for (const field of requiredFields) {
      if (!data[field] || typeof data[field] !== 'string') {
        throw new Error(`Eksik/geçersiz alan: ${field}`);
      }
    }

    // Firestore'a veri ekleme
    const docRef = await addDoc(collection(db, "internetsitesi"), {
      name: data.name.trim(),
      phone: data.phone.trim(),
      subject: data.subject.trim(),
      email: data.email.trim(),
      message: data.message.trim(),
      timestamp: serverTimestamp() // Firebase sunucu zamanını kullan
    });
    
    console.log("Doküman başarıyla oluşturuldu. ID:", docRef.id);
    return true;
    
  } catch (error) {
    console.error("Kayıt hatası:", {
      error: error.message,
      stack: error.stack,
      formData: data
    });
    
    return false;
  }
}

export { 
  initializeFirebase, 
  saveContactForm
};