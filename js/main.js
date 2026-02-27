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

        // Análisis Mensual
        const btnOpenAnalysis = document.getElementById('btnOpenAnalysis');
        const closeAnalysisBtn = document.getElementById('closeAnalysisBtn');
        const monthlyAnalysisModal = document.getElementById('monthlyAnalysisModal');

        if (btnOpenAnalysis && monthlyAnalysisModal) {
            btnOpenAnalysis.addEventListener('click', () => {
                this.buildAnalysis();
                monthlyAnalysisModal.classList.add('active');
            });

            closeAnalysisBtn.addEventListener('click', () => {
                monthlyAnalysisModal.classList.remove('active');
            });

            monthlyAnalysisModal.addEventListener('click', (e) => {
                if(e.target === monthlyAnalysisModal) monthlyAnalysisModal.classList.remove('active');
            });
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

    buildAnalysis() {
        const sales = StorageService.getSales();
        const analysisList = document.getElementById('analysisList');
        if(!analysisList) return;

        analysisList.innerHTML = '';
        const monthlyData = {};
        
        // Diccionario de meses en español
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        sales.forEach(sale => {
            // Solo contabilizamos ventas efectivamente cerradas (No incluir presupuestos caídos ni eliminadas virtualmente, si aplica)
            // Asumimos que cuentan todas las realizadas (pagadas o no, son ingresos del mes aunque estén por cobrar).
            // Si el usuario quiere solo cobrar, envolver en if(sale.isPaid). Lo haremos estándar.
            
            const d = new Date(sale.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // ej: "2026-02"
            
            if(!monthlyData[key]) {
                 monthlyData[key] = {
                     year: d.getFullYear(),
                     monthStr: monthNames[d.getMonth()],
                     revenue: 0,
                     cost: 0
                 };
            }
            
            monthlyData[key].revenue += Number(sale.total || 0);
            monthlyData[key].cost += Number(sale.costTotal || 0); // Este campo lo implementamos en versiones previas
        });

        const keys = Object.keys(monthlyData).sort((a,b) => b.localeCompare(a)); // Ordenar descendente (más recientes primero)
        
        if (keys.length === 0) {
            analysisList.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons-round" style="font-size: 48px; color: var(--border-color); margin-bottom: 10px;">analytics</span>
                    <h3>No hay datos</h3>
                    <p style="margin-top: 5px;">Realiza ventas primero para ver estadísticas.</p>
                </div>
            `;
            return;
        }

        keys.forEach(k => {
            const data = monthlyData[k];
            const profit = data.revenue - data.cost;
            const isProfit = profit >= 0;

            const card = document.createElement('div');
            card.className = 'card';
            card.style.marginBottom = '15px';
            card.style.borderLeft = `4px solid ${isProfit ? 'var(--secondary)' : 'var(--danger)'}`;
            
            // UI Desglose
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom:10px; margin-bottom:10px;">
                    <h3 style="margin:0; font-size:1.1rem;">${data.monthStr} ${data.year}</h3>
                    <div style="text-align:right;">
                        <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Beneficio Neto</span>
                        <span style="font-weight:700; font-size:1.2rem; color:${isProfit ? 'var(--secondary)' : 'var(--danger)'};">${profit > 0 ? '+' : ''}${AppUtil.formatCurrency(profit)}</span>
                    </div>
                </div>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div style="background:var(--bg-input); padding:10px; border-radius:var(--radius-sm); text-align:center;">
                        <span style="font-size:0.7rem; color:var(--text-muted); display:block; text-transform:uppercase;">Ingresos Brutos</span>
                        <span style="font-weight:600; color:var(--text-main); font-size:1.05rem;">${AppUtil.formatCurrency(data.revenue)}</span>
                    </div>
                    <div style="background:var(--bg-input); padding:10px; border-radius:var(--radius-sm); text-align:center;">
                        <span style="font-size:0.7rem; color:var(--text-muted); display:block; text-transform:uppercase;">Inversión / Coste</span>
                        <span style="font-weight:600; color:var(--danger); font-size:1.05rem;">${AppUtil.formatCurrency(data.cost)}</span>
                    </div>
                </div>
            `;
            analysisList.appendChild(card);
        });
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
