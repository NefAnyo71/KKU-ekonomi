import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Firebase API Yapılandırması
const firebaseConfig = {
  apiKey: "AIzaSyAZmlsg39WMW_B-4MpQ2HaEv7FQPvXjoq8",
  authDomain: "ekos-62f46.firebaseapp.com",
  databaseURL: "https://ekos-62f46-default-rtdb.firebaseio.com",
  projectId: "ekos-62f46",
  storageBucket: "ekos-62f46.firebasestorage.app",
  messagingSenderId: "83588029480",
  appId: "1:83588029480:web:c21d4536c7d6ee69b8691d",
  measurementId: "G-ZV5S3CK9YJ"
};

// Firebase bağlantı durumu için değişkenler
let app;
let db;
let analytics;
let isInitialized = false;

// Firebase başlatma fonksiyonu
async function initializeFirebase() {
  if (isInitialized) return;

  try {
    // Firebase'i başlat
    app = initializeApp(firebaseConfig);
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
      timestamp: serverTimestamp()
    });
    
    console.log("Doküman başarıyla oluşturuldu. ID:", docRef.id);
    return { success: true, docId: docRef.id };
    
  } catch (error) {
    console.error("Kayıt hatası:", {
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

export { 
  initializeFirebase, 
  saveContactForm
};