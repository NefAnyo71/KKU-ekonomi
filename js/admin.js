// Proxy server URL
const PROXY_SERVER_URL = 'https://proxyserver-flax.vercel.app';

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
function saveCredentialsToCookie(username, password, remember) {
    if (remember) {
        const credentials = {
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
            return {
                username: decodeURIComponent(escape(atob(credentials.username))),
                password: decodeURIComponent(escape(atob(credentials.password)))
            };
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

// Sayfa yüklendiğinde çalışacak fonksiyon
document.addEventListener('DOMContentLoaded', function() {
    // Çerezden bilgileri yükle
    const credentials = loadCredentialsFromCookie();
    if (credentials) {
        document.getElementById('login-username').value = credentials.username;
        document.getElementById('login-password').value = credentials.password;
    }

    // Giriş formu event listener
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errorElement = document.getElementById('login-error');
        const loginButtonText = document.getElementById('login-button-text');
        const loginButtonLoading = document.getElementById('login-button-loading');

        // Loading durumunu göster
        loginButtonText.style.display = 'none';
        loginButtonLoading.style.display = 'inline-block';
        errorElement.textContent = '';

        try {
            const result = await loginWithProxy(username, password);

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
            // Loading durumunu gizle
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
    document.addEventListener('click', function(e) {
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
