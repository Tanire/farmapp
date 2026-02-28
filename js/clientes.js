/**
 * Lógica del Módulo de Clientes
 */

class ClientsModule {
    constructor() {
        this.listEl = document.getElementById('clientsList');
        this.clientModal = document.getElementById('clientModal');
        this.profileModal = document.getElementById('profileModal');
        this.form = document.getElementById('clientForm');
        this.searchInput = document.getElementById('searchClient');
        
        this.currentProfileId = null;

        this.bindEvents();
        this.renderList();
    }

    bindEvents() {
        // Modal Formularios
        document.getElementById('btnNewClient').addEventListener('click', () => this.openClientModal());
        document.getElementById('closeClientModalBtn').addEventListener('click', () => this.clientModal.classList.remove('active'));
        document.getElementById('closeProfileBtn').addEventListener('click', () => this.profileModal.classList.remove('active'));
        
        document.getElementById('btnEditClientProfile').addEventListener('click', () => {
            const clients = StorageService.getClients();
            const client = clients.find(c => c.id === this.currentProfileId);
            if(client) {
                this.profileModal.classList.remove('active');
                this.openClientModal(client);
            }
        });
        
        // Eliminar Cliente
        const btnDelete = document.getElementById('btnDeleteClient');
        if (btnDelete) {
            btnDelete.addEventListener('click', () => this.deleteCurrentClient());
        }

        // Click fuera para cerrar modales
        this.clientModal.addEventListener('click', (e) => {
            if (e.target === this.clientModal) this.clientModal.classList.remove('active');
        });
        this.profileModal.addEventListener('click', (e) => {
            if (e.target === this.profileModal) this.profileModal.classList.remove('active');
        });

        // Form Submit
        this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Buscador Front-end
        this.searchInput.addEventListener('input', (e) => this.renderList(e.target.value));
    }

    openClientModal(clientData = null) {
        this.form.reset();
        document.getElementById('clientId').value = '';

        if (clientData) {
            document.getElementById('modalTitle').textContent = 'Editar Cliente';
            document.getElementById('clientId').value = clientData.id;
            document.getElementById('cliClave').value = clientData.clave || '';
            document.getElementById('cliName').value = clientData.name;
            document.getElementById('cliPhone').value = clientData.phone || '';
            document.getElementById('cliAddress').value = clientData.address || '';
        } else {
            document.getElementById('modalTitle').textContent = 'Nuevo Cliente';
            document.getElementById('cliClave').value = this.generateNextClave();
        }

        this.clientModal.classList.add('active');
    }

    generateNextClave() {
        const clients = StorageService.getClients();
        // Buscar todas las claves que empiecen por CLI- y extraer el número
        let maxNum = 0;
        clients.forEach(c => {
            if (c.clave && c.clave.startsWith('CLI-')) {
                const num = parseInt(c.clave.replace('CLI-', ''), 10);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        });
        // Si no hay ninguno, maxNum es 0. Retornar CLI-001, etc.
        const nextNum = maxNum + 1;
        return `CLI-${String(nextNum).padStart(3, '0')}`;
    }

    handleFormSubmit(e) {
        e.preventDefault();

        const id = document.getElementById('clientId').value;
        const name = document.getElementById('cliName').value.trim();
        const phone = document.getElementById('cliPhone').value.trim();
        const address = document.getElementById('cliAddress').value.trim();
        
        let clave = document.getElementById('cliClave').value.trim();
        if(!clave) clave = this.generateNextClave();

        const clients = StorageService.getClients();

        // Evitar duplicados por nombre exacto o teléfono exacto (si lo han puesto)
        const isDuplicate = clients.some(c => 
            c.id !== id && 
            (c.name.toLowerCase() === name.toLowerCase() || (phone !== '' && c.phone === phone))
        );

        if (isDuplicate) {
            AppUtil.showToast("Este cliente ya existe (mismo nombre o teléfono)", "error");
            return;
        }

        const newClient = {
            id: id || undefined,
            clave, name, phone, address,
            updatedAt: new Date().toISOString()
        };

        if (id) {
            const index = clients.findIndex(c => c.id === id);
            if (index > -1) {
                clients[index] = newClient;
                StorageService.saveClients(clients);
                AppUtil.showToast("Cliente actualizado", "success");
            }
        } else {
            StorageService.addClient(newClient);
            AppUtil.showToast("Cliente creado", "success");
        }

        this.clientModal.classList.remove('active');
        this.renderList();
    }

    deleteCurrentClient() {
        if (!this.currentProfileId) return;
        
        // Comprobar si tiene historial de ventas
        const { sales } = this.getDebtData(this.currentProfileId);
        if (sales.length > 0) {
            const cnf = confirm(`Este cliente tiene ${sales.length} ventas en su historial. ¿Estás SEGURO de que deseas borrarlo? Toda estadística relacionada quedará sin asignar.`);
            if(!cnf) return;
        } else {
            if(!confirm("¿Eliminar cliente definitivamente?")) return;
        }

        const clients = StorageService.getClients();
        const newClients = clients.filter(c => c.id !== this.currentProfileId);
        StorageService.saveClients(newClients);
        
        AppUtil.showToast("Cliente eliminado", "success");
        this.profileModal.classList.remove('active');
        this.renderList();
    }

    // Calcula deudas basándose en ventas registradas para el cliente
    getDebtData(clientId) {
        const sales = StorageService.getSales().filter(s => s.clientId === clientId);
        
        const totalBought = sales.reduce((acc, sale) => acc + (sale.total || 0), 0);
        const debt = sales.filter(s => !s.isPaid).reduce((acc, sale) => acc + (sale.total || 0), 0);

        return { totalBought, debt, sales };
    }

    openProfile(client) {
        this.currentProfileId = client.id;
        document.getElementById('profName').textContent = client.name;
        
        const { totalBought, debt, sales } = this.getDebtData(client.id);

        document.getElementById('profTotal').textContent = AppUtil.formatCurrency(totalBought);
        document.getElementById('profDebt').textContent = AppUtil.formatCurrency(debt);
        
        const historyContainer = document.getElementById('clientHistory');
        historyContainer.innerHTML = '';

        if (sales.length === 0) {
            historyContainer.innerHTML = '<p class="text-muted" style="text-align:center;">No hay compras aún</p>';
        } else {
            // Ordenar por fecha descendente
            sales.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(sale => {
                const item = document.createElement('div');
                item.className = 'history-item';
                
                // Mostrar solo los items o recuento
                const itemsStr = sale.items.map(i => `${i.qty}x ${i.productName}`).join(', ');

                item.innerHTML = `
                    <div style="flex-grow:1;">
                        <div style="font-size: 0.85rem; font-weight: 600;">${AppUtil.formatDate(sale.date)}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${itemsStr.substring(0,40)}${itemsStr.length>40?'...':''}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700;">${AppUtil.formatCurrency(sale.total)}</div>
                        <div style="font-size: 0.7rem; color: ${sale.isPaid ? 'var(--secondary)':'var(--accent)'}; font-weight:600;">
                            ${sale.isPaid ? 'COBRADO' : 'PENDIENTE'}
                        </div>
                    </div>
                `;
                historyContainer.appendChild(item);
            });
        }

        this.profileModal.classList.add('active');
    }

    renderList(filterText = '') {
        const clients = StorageService.getClients();
        this.listEl.innerHTML = '';

        const filterLower = filterText.toLowerCase();

        const filtered = clients.filter(c => 
            c.name.toLowerCase().includes(filterLower) || 
            (c.phone && c.phone.includes(filterLower))
        );

        if (filtered.length === 0) {
            this.listEl.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons-round" style="font-size: 64px; color: var(--border-color); margin-bottom: 15px;">group</span>
                    <h3>No hay clientes</h3>
                    <p style="margin-top: 5px;">Añade tu primer cliente pulsando el botón +.</p>
                </div>
            `;
            return;
        }

        filtered.forEach(client => {
            const { debt } = this.getDebtData(client.id);

            const card = document.createElement('div');
            card.className = 'client-card';
            
            const initials = client.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
            
            const claveDisplay = client.clave ? `<span style="font-size: 0.65rem; background: var(--bg-input); padding: 2px 6px; border-radius: 4px; margin-left: 8px;">${client.clave}</span>` : '';

            card.innerHTML = `
                <div class="client-header">
                    <div class="client-info">
                        <div class="client-avatar">${initials}</div>
                        <div class="client-details">
                            <h3 style="display:flex; align-items:center;">${client.name} ${claveDisplay}</h3>
                            <p>${client.phone || 'Sin télefono'}</p>
                        </div>
                    </div>
                    <div class="client-debt">
                        <div class="debt-label">Deuda</div>
                        <div class="debt-amount ${debt > 0 ? 'has-debt' : 'no-debt'}">
                            ${AppUtil.formatCurrency(debt)}
                        </div>
                    </div>
                </div>
            `;

            // Al hacer click abrimos el perfil
            card.addEventListener('click', () => this.openProfile(client));

            this.listEl.appendChild(card);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.clientsApp = new ClientsModule();
});
