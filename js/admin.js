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

// Kullanıcı bilgilerini çereze kaydet
function saveCredentialsToCookie(email, password, remember) {
    if (remember) {
        // Bilgileri şifreleyerek sakla (basit bir Base64 şifreleme)
        const credentials = {
            email: btoa(unescape(encodeURIComponent(email))),
            password: btoa(unescape(encodeURIComponent(password)))
        };
        setCookie('admin_credentials', JSON.stringify(credentials), 120); // 120 gün saklayacak
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
            return {
                email: decodeURIComponent(escape(atob(credentials.email))),
                password: decodeURIComponent(escape(atob(credentials.password)))
            };
        } catch (e) {
            console.error('Çerez bilgileri okunamadı:', e);
            return null;
        }
    }
    return null;
}

// Firebase configuration and initialization
let auth;
let db;

// Main initialization
(async function() {
    // Firebase configuration from proxy server
    async function fetchFirebaseConfig() {
        try {
            const response = await fetch('https://proxyserver-flax.vercel.app/api/config');
            if (!response.ok) {
                throw new Error('Firebase yapılandırması alınamadı');
            }
            const config = await response.json();
            return config.data || config;
        } catch (error) {
            console.error('Yapılandırma hatası:', error);
            document.getElementById('login-error').textContent = 'Yapılandırma hatası. Lütfen daha sonra tekrar deneyin.';
            return null;
        }
    }

    // Initialize Firebase
    async function initializeFirebase() {
        const firebaseConfig = await fetchFirebaseConfig();

        if (!firebaseConfig) {
            return null;
        }

        try {
            // Initialize Firebase
            const app = firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            db = firebase.firestore();

            return { app, auth, db };
        } catch (error) {
            console.error('Firebase başlatma hatası:', error);
            document.getElementById('login-error').textContent = 'Bağlantı hatası. Lütfen daha sonra tekrar deneyin.';
            return null;
        }
    }

    const firebaseAppResult = await initializeFirebase();

    if (!firebaseAppResult) {
        return;
    }

    auth = firebaseAppResult.auth;
    db = firebaseAppResult.db;

    // Sayfa yüklendiğinde çerezden bilgileri yükle
    const credentials = loadCredentialsFromCookie();
    if (credentials) {
        document.getElementById('login-email').value = credentials.email;
        document.getElementById('login-password').value = credentials.password;
        
        // Otomatik giriş yapmayı dene
        setTimeout(() => {
            document.getElementById('login-form').dispatchEvent(new Event('submit'));
        }, 500);
    }

    // Login form handler
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorElement = document.getElementById('login-error');
        const loginButtonText = document.getElementById('login-button-text');
        const loginButtonLoading = document.getElementById('login-button-loading');

        loginButtonText.style.display = 'none';
        loginButtonLoading.style.display = 'inline-block';

        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Check if user is admin
            const isAdmin = await checkAdminStatus(db, user.uid);

            if (isAdmin) {
                // Save credentials to cookie
                saveCredentialsToCookie(email, password, true);
                
                // Show admin panel
                document.getElementById('login-container').style.display = 'none';
                document.getElementById('admin-panel').style.display = 'flex';
            } else {
                await auth.signOut();
                throw new Error('Bu sayfaya erişim yetkiniz yok');
            }
        } catch (error) {
            errorElement.textContent = error.message;
            console.error('Giriş hatası:', error);
        } finally {
            loginButtonText.style.display = 'inline-block';
            loginButtonLoading.style.display = 'none';
        }
    });

    // Check auth state on page load
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const isAdmin = await checkAdminStatus(db, user.uid);
            if (isAdmin) {
                document.getElementById('login-container').style.display = 'none';
                document.getElementById('admin-panel').style.display = 'flex';
                initializeAdminPanel();
            } else {
                await auth.signOut();
                document.getElementById('login-container').style.display = 'flex';
                document.getElementById('admin-panel').style.display = 'none';
            }
        } else {
            document.getElementById('login-container').style.display = 'flex';
            document.getElementById('admin-panel').style.display = 'none';
        }
    });
})();

// Check if user is admin
async function checkAdminStatus(database, uid) {
    try {
        const doc = await database.collection('admins').doc(uid).get();
        return doc.exists;
    } catch (error) {
        console.error('Admin kontrol hatası:', error);
        return false;
    }
}

// Initialize admin panel functionality
function initializeAdminPanel() {
    const logoutButton = document.querySelector('#admin-panel .logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                await firebase.auth().signOut();
                deleteCookie('admin_credentials');
                document.getElementById('admin-panel').style.display = 'none';
                document.getElementById('login-container').style.display = 'flex';
                document.getElementById('login-form').reset();
            } catch (error) {
                console.error('Çıkış hatası:', error);
            }
        });
    }
}

// Function to show different admin sections
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