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

// Proxy kullanıcı bilgilerini çereze kaydet
function saveCredentialsToCookie(username, password, remember) {
    if (remember) {
        const credentials = {
            type: 'proxy',
            username: btoa(unescape(encodeURIComponent(username))),
            password: btoa(unescape(encodeURIComponent(password)))
        };
        setCookie('admin_credentials', JSON.stringify(credentials), 30);
    } else {
        deleteCookie('admin_credentials');
    }
}

// Firebase kullanıcı bilgilerini çereze kaydet
function saveFirebaseCredentialsToCookie(email, password, remember) {
    if (remember) {
        const credentials = {
            type: 'firebase',
            email: btoa(unescape(encodeURIComponent(email))),
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
            } else if (credentials.type === 'firebase') {
                return {
                    type: 'firebase',
                    email: decodeURIComponent(escape(atob(credentials.email))),
                    password: decodeURIComponent(escape(atob(credentials.password)))
                };
            } else if (credentials.type === 'proxy') {
                return {
                    type: 'proxy',
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

// Proxy server ile giriş kontrolü
async function loginWithProxy(username, password) {
    try {
        const response = await fetch(`${PROXY_SERVER_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();
        
        if (response.ok && result.status === 'success') {
            return { success: true, message: result.message };
        } else {
            return { success: false, message: result.message || 'Giriş başarısız' };
        }
    } catch (error) {
        console.error('Giriş hatası:', error);
        return { success: false, message: 'Bağlantı hatası. Lütfen daha sonra tekrar deneyin.' };
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

// Admin kontrolü
async function checkAdminStatus(uid) {
    try {
        const doc = await db.collection('admins').doc(uid).get();
        return doc.exists;
    } catch (error) {
        console.error('Admin kontrol hatası:', error);
        return false;
    }
}

// Firebase ile giriş
async function loginWithFirebase(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        const isAdmin = await checkAdminStatus(user.uid);
        if (!isAdmin) {
            await auth.signOut();
            throw new Error('Bu hesapla giriş yetkiniz yok');
        }
        
        return { success: true, user };
    } catch (error) {
        return { success: false, message: error.message };
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
    
    // Auth state listener
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const isAdmin = await checkAdminStatus(user.uid);
            if (isAdmin) {
                document.getElementById('login-container').style.display = 'none';
                document.getElementById('admin-panel').style.display = 'flex';
                initializeAdminPanel();
            } else {
                await auth.signOut();
            }
        }
    });
    // Çerezden bilgileri yükle
    const credentials = loadCredentialsFromCookie();
    if (credentials) {
        if (credentials.type === 'firebase') {
            document.getElementById('login-email').value = credentials.email;
            document.getElementById('login-password').value = credentials.password;
        } else if (credentials.type === 'proxy') {
            document.getElementById('login-username').value = credentials.username;
            document.getElementById('login-password').value = credentials.password;
        }
    }

    // Giriş formu event listener
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errorElement = document.getElementById('login-error');
        const loginButtonText = document.getElementById('login-button-text');
        const loginButtonLoading = document.getElementById('login-button-loading');

        loginButtonText.style.display = 'none';
        loginButtonLoading.style.display = 'inline-block';
        errorElement.textContent = '';

        try {
            let result;
            
            // Email varsa Firebase ile giriş yap
            if (email) {
                result = await loginWithFirebase(email, password);
                if (result.success) {
                    saveFirebaseCredentialsToCookie(email, password, true);
                }
            } 
            // Username varsa proxy ile giriş yap
            else if (username) {
                result = await loginWithProxy(username, password);
                if (result.success) {
                    saveCredentialsToCookie(username, password, true);
                    document.getElementById('login-container').style.display = 'none';
                    document.getElementById('admin-panel').style.display = 'flex';
                    initializeAdminPanel();
                }
            }
            
            if (!result.success) {
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
            
            try {
                // Firebase'den çıkış yap
                if (auth && auth.currentUser) {
                    await auth.signOut();
                }
            } catch (error) {
                console.error('Firebase çıkış hatası:', error);
            }
            
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