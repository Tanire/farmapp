/**
 * Main App Script - FarmApp
 */

const AppUtil = {
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            toast.className = `toast ${type}`;
        }, 3000);
    },

    formatCurrency(amount) {
        return Number(amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
    },
    
    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES');
    }
};

class DashboardApp {
    constructor() {
        this.initPWA();
        this.bindEvents();
        
        // Check Login (Onboarding)
        this.checkLogin();

        // Si estamos en index.html, cargamos el dashboard
        if (document.getElementById('todaySales')) {
            this.loadDashboardData();
        }
        
        // Auto-sincronización silenciosa al abrir la app
        this.autoSync();
    }

    initPWA() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(registration => {
                        console.log('SW registrado con éxito:', registration.scope);
                    })
                    .catch(err => {
                        console.error('Error registrando SW:', err);
                    });
            });
        }
    }

    bindEvents() {
        const btnSync = document.getElementById('btnSync');
        if (btnSync) {
            btnSync.addEventListener('click', () => this.handleManualSync());
        }

        // Escuchar cambios locales para subirlos
        window.addEventListener('farmapp_data_changed', () => {
             this.autoSync();
        });

        // Botón Login
        const btnLogin = document.getElementById('btnLogin');
        if(btnLogin) {
             btnLogin.addEventListener('click', () => this.processLogin());
        }
    }

    checkLogin() {
        const userEmail = localStorage.getItem('farmapp_seller_email');
        const loginModal = document.getElementById('loginModal');
        
        if (!userEmail && loginModal) {
            loginModal.classList.add('active'); // Mostrar el login form y bloquear detrás
        }
    }

    async processLogin() {
        const nameInput = document.getElementById('loginName').value.trim();
        const emailInput = document.getElementById('loginEmail').value.trim().toLowerCase();
        
        if(!nameInput || !emailInput || !emailInput.includes('@')) {
             AppUtil.showToast("Por favor, introduce un nombre y un correo válido", "error");
             return;
        }

        // Guardar credenciales de usuario localmente
        localStorage.setItem('farmapp_seller_name', nameInput);
        localStorage.setItem('farmapp_seller_email', emailInput);
        
        document.getElementById('loginModal').classList.remove('active');
        AppUtil.showToast(`¡Bienvenido/a, ${nameInput}!`, "success");
        
        // Disparar sincronización para bajar sus datos desde la nube
        this.autoSync();
    }

    loadDashboardData() {
        const sales = StorageService.getSales();
        
        // Calcular ventas de HOY
        const today = new Date().toISOString().split('T')[0];
        const todaySalesAmount = sales
            .filter(sale => sale.date.startsWith(today))
            .reduce((total, sale) => total + Number(sale.total || 0), 0);
            
        // Calcular pendiente de cobro (histórico global que no esté marcado como cobrado)
        const pendingAmount = sales
            .filter(sale => !sale.isPaid)
            .reduce((total, sale) => total + Number(sale.total || 0), 0);
            
        document.getElementById('todaySales').textContent = AppUtil.formatCurrency(todaySalesAmount);
        document.getElementById('todaySales').className = `stat-value ${todaySalesAmount > 0 ? 'text-secondary' : ''}`;
        
        document.getElementById('pendingCollection').textContent = AppUtil.formatCurrency(pendingAmount);
        document.getElementById('pendingCollection').className = `stat-value ${pendingAmount > 0 ? 'text-accent' : ''}`;
    }

    async handleManualSync() {
        // Usar credenciales del administrador en LocalStorage
        const token = localStorage.getItem('farmapp_github_token');
        const gistId = localStorage.getItem('farmapp_gist_id');

        if (!token || !gistId) {
             AppUtil.showToast("El administrador debe configurar el Token en Ajustes", "error");
             return;
        }

        const email = localStorage.getItem('farmapp_seller_email');
        if (!email) {
            AppUtil.showToast("Identifícate primero recargando la página", "error");
            return;
        }

        const btnSync = document.getElementById('btnSync');
        if (btnSync) {
            btnSync.style.animation = 'spin 1s linear infinite';
            btnSync.querySelector('.material-icons-round').style.color = 'var(--accent)';
        }

        try {
            AppUtil.showToast("Sincronizando con la nube...", "success");
            const result = await SyncService.syncWithCloud(token, gistId);
            
            if (result.success) {
                AppUtil.showToast("¡Datos Sincronizados!", "success");
                if (document.getElementById('todaySales')) {
                    this.loadDashboardData(); // Recargar datos locales
                }
            } else {
                AppUtil.showToast("Error de Sync: " + result.error, "error");
            }
        } catch (e) {
            AppUtil.showToast("Error de Sincronización.", "error");
        } finally {
            if (btnSync) {
                btnSync.style.animation = 'none';
                btnSync.querySelector('.material-icons-round').style.color = 'var(--text-main)';
            }
        }
    }

    async autoSync() {
        const token = localStorage.getItem('farmapp_github_token');
        const gistId = localStorage.getItem('farmapp_gist_id');
        if (!token || !gistId) return; // No auto-sync si no hay config admin
        
        const email = localStorage.getItem('farmapp_seller_email');
        if (!email) return;

        const btnSync = document.getElementById('btnSync');
        if (btnSync) {
            btnSync.style.animation = 'spin 1s linear infinite';
            btnSync.querySelector('.material-icons-round').style.color = 'var(--text-muted)';
        }

        try {
            const result = await SyncService.syncWithCloud(token, gistId);
            if (result.success && document.getElementById('todaySales')) {
                this.loadDashboardData();
            }
        } catch (e) {
            console.error("Auto Sync failed", e);
        } finally {
            if (btnSync) {
                btnSync.style.animation = 'none';
                btnSync.querySelector('.material-icons-round').style.color = 'var(--text-main)';
            }
        }
    }
}

// Inicializar la aplicación al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DashboardApp();
    
    // Inyectar animación para la recarga en CSS de forma dinámica si no está
    if (!document.getElementById('dynamicStyles')) {
        const style = document.createElement('style');
        style.id = 'dynamicStyles';
        style.textContent = `
            @keyframes spin { 100% { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);
    }
});
