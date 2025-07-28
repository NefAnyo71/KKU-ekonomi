// Proxy server URL
const PROXY_SERVER_URL = 'https://proxyserver-flax.vercel.app';

// Firebase variables
let auth;
let db;
let GOOGLE_CLIENT_ID = null;

// Yetkili Google hesapları
const AUTHORIZED_EMAILS = [
    'admin@kkuekonomi.com',
    'yonetim@kkuekonomi.com',
    // Buraya yetkili email adreslerini ekleyin
];

// Çerez işlemleri için yardımcı fonksiyonlar
function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax;Secure`;
}

function getCookie(name) {
    const cookieArr = document.cookie.split(';');
    for(let i = 0; i < cookieArr.length; i++) {
        const cookiePair = cookieArr[i].trim().split('=');
        if(name === cookiePair[0]) {
            return decodeURIComponent(cookiePair[1]);
        }
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax;Secure`;
}

// Firebase'i başlat
async function initializeFirebase() {
    try {
        const response = await fetch(`${PROXY_SERVER_URL}/api/config`);
        if (!response.ok) throw new Error('Firebase config alınamadı');
        
        const config = await response.json();
        const firebaseConfig = config.data || config;
        
        const app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        
        return true;
    } catch (error) {
        console.error('Firebase başlatma hatası:', error);
        return false;
    }
}

// loginadmin collection'dan giriş kontrolü
async function loginWithFirestore(username, password) {
    try {
        const querySnapshot = await db.collection('loginadmin')
            .where('username', '==', username)
            .where('password', '==', password)
            .get();
        
        if (!querySnapshot.empty) {
            return { success: true, message: 'Giriş başarılı!' };
        } else {
            return { success: false, message: 'Kullanıcı adı veya şifre hatalı!' };
        }
    } catch (error) {
        console.error('Firestore giriş hatası:', error);
        return { success: false, message: 'Bağlantı hatası. Lütfen tekrar deneyin.' };
    }
}

// Google Sign-In callback fonksiyonu
function handleCredentialResponse(response) {
    try {
        const responsePayload = decodeJwtResponse(response.credential);
        const email = responsePayload.email;
        const name = responsePayload.name;
        
        // Email kontrolü
        if (AUTHORIZED_EMAILS.includes(email)) {
            // Başarılı giriş
            saveGoogleCredentialsToCookie(email, name);
            
            // Admin panelini göster
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('admin-panel').style.display = 'flex';
            
            initializeAdminPanel();
        } else {
            document.getElementById('login-error').textContent = 'Bu Google hesabı ile giriş yetkiniz yok.';
        }
    } catch (error) {
        console.error('Google giriş hatası:', error);
        document.getElementById('login-error').textContent = 'Google ile giriş başarısız.';
    }
}

// JWT token'ı decode etme fonksiyonu
function decodeJwtResponse(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

// Google credentials'ı çereze kaydet
function saveGoogleCredentialsToCookie(email, name) {
    const credentials = {
        type: 'google',
        email: btoa(unescape(encodeURIComponent(email))),
        name: btoa(unescape(encodeURIComponent(name)))
    };
    setCookie('admin_credentials', JSON.stringify(credentials), 30);
}

// Kullanıcı bilgilerini çereze kaydet
function saveCredentialsToCookie(username, password, remember) {
    if (remember) {
        const credentials = {
            type: 'firestore',
            username: btoa(unescape(encodeURIComponent(username))),
            password: btoa(unescape(encodeURIComponent(password)))
        };
        setCookie('admin_credentials', JSON.stringify(credentials), 30);
    } else {
        deleteCookie('admin_credentials');
    }
}

// Çerezden kullanıcı bilgilerini yükle
function loadCredentialsFromCookie() {
    const credentialsCookie = getCookie('admin_credentials');
    if (credentialsCookie) {
        try {
            const credentials = JSON.parse(credentialsCookie);
            if (credentials.type === 'google') {
                return {
                    type: 'google',
                    email: decodeURIComponent(escape(atob(credentials.email))),
                    name: decodeURIComponent(escape(atob(credentials.name)))
                };
            } else if (credentials.type === 'firestore') {
                return {
                    type: 'firestore',
                    username: decodeURIComponent(escape(atob(credentials.username))),
                    password: decodeURIComponent(escape(atob(credentials.password)))
                };
            }
        } catch (e) {
            console.error('Çerez bilgileri okunamadı:', e);
            return null;
        }
    }
    return null;
}

// Firebase config'den Google Client ID'yi al
async function initializeGoogleSignIn() {
    try {
        const response = await fetch(`${PROXY_SERVER_URL}/api/config`);
        if (response.ok) {
            const config = await response.json();
            const firebaseConfig = config.data || config;
            
            // Firebase config'den Google Client ID'yi çıkar
            if (firebaseConfig.messagingSenderId) {
                GOOGLE_CLIENT_ID = `${firebaseConfig.messagingSenderId}-your-google-client-id.apps.googleusercontent.com`;
                
                // Google Sign-In'i başlat
                const onloadDiv = document.getElementById('g_id_onload');
                if (onloadDiv) {
                    onloadDiv.setAttribute('data-client_id', GOOGLE_CLIENT_ID);
                }
            }
        }
    } catch (error) {
        console.error('Google Sign-In başlatma hatası:', error);
    }
}

// Sayfa yüklendiğinde çalışacak fonksiyon
document.addEventListener('DOMContentLoaded', async function() {
    // Firebase'i başlat
    const firebaseInitialized = await initializeFirebase();
    if (!firebaseInitialized) {
        document.getElementById('login-error').textContent = 'Sistem başlatılamadı.';
        return;
    }
    
    // Google Sign-In'i başlat
    await initializeGoogleSignIn();

    // Çerezden bilgileri yükle
    const credentials = loadCredentialsFromCookie();
    if (credentials) {
        if (credentials.type === 'google') {
            // Google ile otomatik giriş
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('admin-panel').style.display = 'flex';
            initializeAdminPanel();
            return;
        } else if (credentials.type === 'firestore') {
            document.getElementById('login-username').value = credentials.username;
            document.getElementById('login-password').value = credentials.password;
            
            // Otomatik giriş denemesi
            setTimeout(async () => {
                const result = await loginWithFirestore(credentials.username, credentials.password);
                if (result.success) {
                    document.getElementById('login-container').style.display = 'none';
                    document.getElementById('admin-panel').style.display = 'flex';
                    initializeAdminPanel();
                }
            }, 500);
        }
    }

    // Giriş formu event listener
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errorElement = document.getElementById('login-error');
        const loginButtonText = document.getElementById('login-button-text');
        const loginButtonLoading = document.getElementById('login-button-loading');

        loginButtonText.style.display = 'none';
        loginButtonLoading.style.display = 'inline-block';
        errorElement.textContent = '';

        try {
            const result = await loginWithFirestore(username, password);
            
            if (result.success) {
                // Başarılı giriş
                saveCredentialsToCookie(username, password, true);
                
                // Admin panelini göster
                document.getElementById('login-container').style.display = 'none';
                document.getElementById('admin-panel').style.display = 'flex';
                
                initializeAdminPanel();
            } else {
                // Hatalı giriş
                errorElement.textContent = result.message;
            }
        } catch (error) {
            errorElement.textContent = 'Beklenmeyen bir hata oluştu.';
            console.error('Giriş hatası:', error);
        } finally {
            loginButtonText.style.display = 'inline-block';
            loginButtonLoading.style.display = 'none';
        }
    });

    // Çıkış butonu event listener
    initializeLogoutButton();
});

// Admin panel fonksiyonlarını başlat
function initializeAdminPanel() {
    console.log('Admin paneli başlatıldı');
}

// Çıkış butonu işlevselliği
function initializeLogoutButton() {
    document.addEventListener('click', async function(e) {
        if (e.target.closest('.logout-btn')) {
            e.preventDefault();
            
            // Çerezleri temizle
            deleteCookie('admin_credentials');
            
            // Formu temizle
            document.getElementById('login-form').reset();
            document.getElementById('login-error').textContent = '';
            
            // Giriş ekranını göster
            document.getElementById('admin-panel').style.display = 'none';
            document.getElementById('login-container').style.display = 'flex';
        }
    });
}

// Bölüm değiştirme fonksiyonu
function showSection(sectionId, clickedElement = null) {
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.classList.remove('active');
    });
    
    const selectedSection = document.getElementById(sectionId);
    if (selectedSection) {
        selectedSection.classList.add('active');
    }
    
    if (clickedElement) {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
        });
        clickedElement.classList.add('active');
    }
}