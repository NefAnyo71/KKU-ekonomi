import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Firebase bağlantı durumu için değişkenler
let app;
let db;
let analytics;
let isInitialized = false;
let initializationPromise = null;

// Proxy sunucu URL'si
const PROXY_SERVER_URL = 'https://proxyserver-flax.vercel.app';

// Firebase başlatma fonksiyonu (singleton pattern)
async function initializeFirebase() {
  if (isInitialized) return true;
  if (initializationPromise) return initializationPromise;

  try {
    initializationPromise = (async () => {
      const config = await fetchFirebaseConfig();
      
      // Gerekli alanları kontrol et
      validateFirebaseConfig(config);
      
      app = initializeApp(config);
      db = getFirestore(app);
      
      // Analytics sadece destekleniyorsa başlat
      if (await isSupported()) {
        analytics = getAnalytics(app);
      }
      
      isInitialized = true;
      console.log("Firebase başarıyla başlatıldı | ProjectID:", config.projectId);
      return true;
    })();

    return await initializationPromise;
  } catch (error) {
    console.error("Firebase başlatma hatası:", error);
    isInitialized = false;
    initializationPromise = null;
    throw error;
  }
}

// Firebase konfigürasyon doğrulama
function validateFirebaseConfig(config) {
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Eksik Firebase konfigürasyon alanları: ${missingFields.join(', ')}`);
  }

  // ProjectID format kontrolü
  if (!/^[a-z0-9-]+$/.test(config.projectId)) {
    throw new Error(`Geçersiz projectId formatı: ${config.projectId}`);
  }
}

// Proxy üzerinden Firebase config alma
async function fetchFirebaseConfig() {
  try {
    const response = await fetch(`${PROXY_SERVER_URL}/api/config`, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Config alınamadı. HTTP Status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status !== 'success' || !data.data) {
      throw new Error('Geçersiz config yanıt formatı');
    }

    return data.data;
  } catch (error) {
    console.error("Config alma hatası:", error);
    throw new Error(`Proxy sunucudan konfigürasyon alınamadı: ${error.message}`);
  }
}

// Firestore'a veri kaydetme fonksiyonu
async function saveContactForm(data) {
  try {
    // Firebase başlatılmadıysa başlat
    if (!isInitialized) {
      await initializeFirebase();
    }

    // Veri doğrulama
    validateFormData(data);

    // Firestore'a veri ekleme
    const docRef = await addDoc(collection(db, "internetsitesi"), {
      name: data.name.trim(),
      phone: data.phone.trim(),
      subject: data.subject.trim(),
      email: data.email.trim(),
      message: data.message.trim(),
      timestamp: serverTimestamp(),
      ipAddress: await getClientIP() // İsteğe bağlı
    });
    
    console.log("Firestore kaydı başarılı. Doküman ID:", docRef.id);
    return { success: true, docId: docRef.id };
    
  } catch (error) {
    console.error("Firestore kayıt hatası:", {
      error: error.message,
      code: error.code || 'N/A',
      stack: error.stack
    });
    
    return { 
      success: false, 
      error: error.message,
      code: error.code || 'internal-error'
    };
  }
}

// Form veri doğrulama
function validateFormData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Geçersiz form verisi');
  }

  const requiredFields = ['name', 'phone', 'subject', 'email', 'message'];
  const fieldErrors = [];

  requiredFields.forEach(field => {
    if (!data[field]) {
      fieldErrors.push(`${field} alanı boş olamaz`);
    } else if (typeof data[field] !== 'string') {
      fieldErrors.push(`${field} alanı geçersiz formatta`);
    } else if (data[field].trim().length === 0) {
      fieldErrors.push(`${field} alanı sadece boşluklardan oluşamaz`);
    }
  });

  // Email format kontrolü
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    fieldErrors.push('Geçersiz email formatı');
  }

  if (fieldErrors.length > 0) {
    throw new Error(`Form doğrulama hataları: ${fieldErrors.join(', ')}`);
  }
}

// İstemci IP adresini alma (isteğe bağlı)
async function getClientIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json', { timeout: 2000 });
    const data = await response.json();
    return data.ip || 'unknown';
  } catch (error) {
    console.warn("IP adresi alınamadı:", error);
    return 'unknown';
  }
}

export { 
  initializeFirebase, 
  saveContactForm,
  fetchFirebaseConfig as getFirebaseConfig
};