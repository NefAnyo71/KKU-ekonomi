import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Firebase bağlantı durumu için değişkenler
let app;
let db;
let analytics;
let isInitialized = false;
let initializationPromise = null;

// Firebase konfigürasyonunu getirme
async function getFirebaseConfig() {
  try {
    const response = await fetch('https://proxyserver-flax.vercel.app/api/config', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      mode: 'cors',
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Config fetch failed with status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status !== 'success' || !data.data) {
      throw new Error('Invalid config response format');
    }

    return data.data;
  } catch (error) {
    console.error('Error fetching Firebase config:', error);
    throw error;
  }
}

// Firebase başlatma fonksiyonu (singleton pattern)
async function initializeFirebase() {
  if (isInitialized) return;
  if (initializationPromise) return initializationPromise;

  try {
    initializationPromise = (async () => {
      const config = await getFirebaseConfig();
      app = initializeApp(config);
      db = getFirestore(app);
      
      // Analytics sadece destekleniyorsa başlat
      if (await isSupported()) {
        analytics = getAnalytics(app);
      }
      
      isInitialized = true;
      console.log("Firebase successfully initialized");
      return true;
    })();

    return await initializationPromise;
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    isInitialized = false;
    initializationPromise = null;
    throw error;
  }
}

// İletişim formu verilerini kaydetme fonksiyonu
async function saveContactForm(data) {
  try {
    // Firebase başlatılmadıysa başlat
    if (!isInitialized) {
      await initializeFirebase();
    }

    // Veri doğrulama
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid form data');
    }

    const requiredFields = ['name', 'phone', 'subject', 'email', 'message'];
    for (const field of requiredFields) {
      if (!data[field] || typeof data[field] !== 'string') {
        throw new Error(`Missing or invalid field: ${field}`);
      }
    }

    // Firestore'a veri ekleme
    const docData = {
      name: data.name.trim(),
      phone: data.phone.trim(),
      subject: data.subject.trim(),
      email: data.email.trim(),
      message: data.message.trim(),
      timestamp: serverTimestamp(), // Firebase sunucu zamanını kullan
      ipAddress: await getClientIP() // İsteğe bağlı: IP adresi kaydı
    };

    const docRef = await addDoc(collection(db, "internetsitesi"), docData);
    
    console.log("Document successfully written with ID:", docRef.id);
    return { success: true, docId: docRef.id };
    
  } catch (error) {
    console.error("Error saving contact form:", {
      error: error.message,
      stack: error.stack,
      formData: data
    });
    
    return { 
      success: false, 
      error: error.message,
      code: error.code || 'unknown'
    };
  }
}

// İsteğe bağlı: İstemci IP adresini alma
async function getClientIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
}

export { 
  initializeFirebase, 
  saveContactForm,
  getFirebaseConfig
};