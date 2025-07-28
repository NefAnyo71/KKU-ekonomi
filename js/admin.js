// Proxy server URL
const PROXY_SERVER_URL = 'https://proxyserver-flax.vercel.app';

// Firebase variables
let auth;
let db;
let GOOGLE_CLIENT_ID = null;

// Yetkili Google hesapları
const AUTHORIZED_EMAILS = [
    'admin@kkuekonomi.com',
    'yonetim@kkuekonomi.com'
];

// Etkinlik yönetimi değişkenleri
let editingEventId = null;

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

// Google Sign-In'i devre dışı bırak
async function initializeGoogleSignIn() {
    // Google Sign-In butonunu gizle
    const googleSignInDiv = document.querySelector('.g_id_signin');
    const googleOnloadDiv = document.getElementById('g_id_onload');
    const dividerDiv = document.querySelector('.divider');
    
    if (googleSignInDiv) googleSignInDiv.style.display = 'none';
    if (googleOnloadDiv) googleOnloadDiv.style.display = 'none';
    if (dividerDiv) dividerDiv.style.display = 'none';
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
    initializeEventManagement();
}

// Etkinlik yönetimi başlatma
function initializeEventManagement() {
    document.getElementById('event-form').addEventListener('submit', handleEventSubmit);
    document.getElementById('cancel-event-btn').addEventListener('click', cancelEventEdit);
    loadEvents();
}

// Etkinlik kaydetme/güncelleme
async function handleEventSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('event-title').value;
    const date = document.getElementById('event-date').value;
    const details = document.getElementById('event-details').value;
    const url = document.getElementById('event-url').value;
    
    const saveBtn = document.getElementById('save-event-text');
    const saveLoading = document.getElementById('save-event-loading');
    
    saveBtn.style.display = 'none';
    saveLoading.style.display = 'inline-block';
    
    try {
        const eventData = {
            title,
            date: new Date(date),
            details,
            url: url || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (editingEventId) {
            await db.collection('etkinlikler').doc(editingEventId).update(eventData);
        } else {
            eventData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('etkinlikler').add(eventData);
        }
        
        document.getElementById('event-form').reset();
        cancelEventEdit();
        loadEvents();
        
    } catch (error) {
        console.error('Etkinlik kaydetme hatası:', error);
        alert('Etkinlik kaydedilirken hata oluştu!');
    } finally {
        saveBtn.style.display = 'inline-block';
        saveLoading.style.display = 'none';
    }
}

// Etkinlikleri yükle
async function loadEvents() {
    const container = document.getElementById('events-container');
    container.innerHTML = '<div class="loading-message">Etkinlikler yükleniyor...</div>';
    
    try {
        const querySnapshot = await db.collection('etkinlikler')
            .orderBy('date', 'desc')
            .get();
        
        if (querySnapshot.empty) {
            container.innerHTML = '<div class="no-events">Henüz etkinlik eklenmemiş.</div>';
            return;
        }
        
        let eventsHtml = '';
        querySnapshot.forEach((doc) => {
            const event = doc.data();
            let eventDate;
            
            // Tarih formatını kontrol et
            if (event.date && typeof event.date.toDate === 'function') {
                eventDate = event.date.toDate();
            } else if (event.date instanceof Date) {
                eventDate = event.date;
            } else if (typeof event.date === 'string') {
                eventDate = new Date(event.date);
            } else {
                eventDate = new Date();
            }
            
            eventsHtml += `
                <div class="event-item" data-id="${doc.id}">
                    <div class="event-header">
                        <h4>${event.title}</h4>
                        <div class="event-actions">
                            <button class="btn-edit" onclick="editEvent('${doc.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-delete" onclick="deleteEvent('${doc.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="event-date">
                        <i class="fas fa-calendar"></i> ${eventDate.toLocaleDateString('tr-TR')} ${eventDate.toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'})}
                    </div>
                    <div class="event-details">${event.details}</div>
                    ${event.url ? `<div class="event-url"><a href="${event.url}" target="_blank"><i class="fas fa-link"></i> Bağlantı</a></div>` : ''}
                </div>
            `;
        });
        
        container.innerHTML = eventsHtml;
        
    } catch (error) {
        console.error('Etkinlik yükleme hatası:', error);
        container.innerHTML = '<div class="error-message">Etkinlikler yüklenirken hata oluştu.</div>';
    }
}

// Etkinlik düzenleme
async function editEvent(eventId) {
    try {
        const doc = await db.collection('etkinlikler').doc(eventId).get();
        if (!doc.exists) {
            alert('Etkinlik bulunamadı!');
            return;
        }
        
        const event = doc.data();
        let eventDate;
        
        // Tarih formatını kontrol et
        if (event.date && typeof event.date.toDate === 'function') {
            eventDate = event.date.toDate();
        } else if (event.date instanceof Date) {
            eventDate = event.date;
        } else if (typeof event.date === 'string') {
            eventDate = new Date(event.date);
        } else {
            eventDate = new Date();
        }
        
        document.getElementById('event-title').value = event.title;
        document.getElementById('event-date').value = eventDate.toISOString().slice(0, 16);
        document.getElementById('event-details').value = event.details;
        document.getElementById('event-url').value = event.url || '';
        
        editingEventId = eventId;
        document.getElementById('save-event-text').textContent = 'Etkinlik Güncelle';
        document.getElementById('cancel-event-btn').style.display = 'inline-block';
        
        document.getElementById('event-form').scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Etkinlik düzenleme hatası:', error);
        alert('Etkinlik yüklenirken hata oluştu!');
    }
}

// Etkinlik silme
async function deleteEvent(eventId) {
    if (!confirm('Bu etkinliği silmek istediğinizden emin misiniz?')) {
        return;
    }
    
    try {
        await db.collection('etkinlikler').doc(eventId).delete();
        loadEvents();
    } catch (error) {
        console.error('Etkinlik silme hatası:', error);
        alert('Etkinlik silinirken hata oluştu!');
    }
}

// Düzenleme iptal
function cancelEventEdit() {
    editingEventId = null;
    document.getElementById('save-event-text').textContent = 'Etkinlik Kaydet';
    document.getElementById('cancel-event-btn').style.display = 'none';
    document.getElementById('event-form').reset();
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