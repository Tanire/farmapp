/**
 * Lógica del Módulo de Ventas
 */

class SalesModule {
    constructor() {
        this.listEl = document.getElementById('salesList');
        this.fsModal = document.getElementById('newSaleModal');
        this.detailModal = document.getElementById('saleDetailModal');
        
        // Elementos DOM Carrito
        this.clientSelect = document.getElementById('saleClient');
        this.productSelect = document.getElementById('saleProduct');
        this.cartEl = document.getElementById('cartItems');
        this.cartTotalEl = document.getElementById('cartTotalVal');
        this.isPaidCheckbox = document.getElementById('saleIsPaid');
        this.emptyMsg = document.getElementById('cartEmptyMsg');
        
        // Custom UI para Toggle
        this.toggleBg = document.getElementById('toggleBg');
        this.toggleCircle = document.getElementById('toggleCircle');

        // Estado del Carrito actual
        this.cart = []; // { productData, qty, subtotal }
        
        this.viewingSaleId = null;

        this.bindEvents();
        this.renderList();
        this.populateSelects();
    }

    bindEvents() {
        document.getElementById('btnNewSale').addEventListener('click', () => this.openNewSale());
        document.getElementById('closeSaleBtn').addEventListener('click', () => this.fsModal.classList.remove('active'));
        
        document.getElementById('closeDetailBtn').addEventListener('click', () => this.detailModal.classList.remove('active'));
        this.detailModal.addEventListener('click', (e) => {
            if(e.target === this.detailModal) this.detailModal.classList.remove('active');
        });

        // Carrito
        document.getElementById('btnAddProduct').addEventListener('click', () => this.addToCart());
        document.getElementById('btnSaveSale').addEventListener('click', () => this.saveSale());

        // Toggle UI Custom Checkbox
        this.isPaidCheckbox.addEventListener('change', (e) => {
            if(e.target.checked) {
                this.toggleBg.style.backgroundColor = 'var(--secondary)';
                this.toggleCircle.style.left = '26px';
            } else {
                this.toggleBg.style.backgroundColor = 'var(--text-muted)';
                this.toggleCircle.style.left = '4px';
            }
        });

        // Toggle Estado de Pago (Detalle)
        document.getElementById('btnTogglePaid').addEventListener('click', () => this.toggleSalePaymentStatus());
    }

    populateSelects() {
        const clients = StorageService.getClients();
        const products = StorageService.getProducts();

        this.clientSelect.innerHTML = '<option value="" disabled selected>Selecciona un cliente...</option>';
        clients.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            this.clientSelect.appendChild(opt);
        });

        this.productSelect.innerHTML = '<option value="" disabled selected>Elegir producto...</option>';
        products.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} - ${AppUtil.formatCurrency(p.salePrice)}`;
            this.productSelect.appendChild(opt);
        });
    }

    openNewSale() {
        this.cart = [];
        this.populateSelects();
        this.clientSelect.value = '';
        this.productSelect.value = '';
        this.isPaidCheckbox.checked = true;
        this.isPaidCheckbox.dispatchEvent(new Event('change')); // Run UI animation
        
        this.renderCart();
        this.fsModal.classList.add('active');
    }

    addToCart() {
        const pId = this.productSelect.value;
        if (!pId) return;

        const product = StorageService.getProducts().find(p => p.id === pId);
        if (!product) return;

        // Comprobar si ya existe
        const existing = this.cart.find(item => item.product.id === product.id);
        if (existing) {
            existing.qty += 1;
            existing.subtotal = existing.qty * product.salePrice;
            existing.costSubtotal = existing.qty * product.costPrice;
        } else {
            this.cart.push({
                product: product,
                qty: 1,
                subtotal: product.salePrice,
                costSubtotal: product.costPrice
            });
        }

        this.productSelect.value = ''; // Reset select
        this.renderCart();
    }

    updateCartQty(index, change) {
        if (!this.cart[index]) return;
        
        this.cart[index].qty += change;
        
        if (this.cart[index].qty <= 0) {
            this.cart.splice(index, 1);
        } else {
            this.cart[index].subtotal = this.cart[index].qty * this.cart[index].product.salePrice;
            this.cart[index].costSubtotal = this.cart[index].qty * this.cart[index].product.costPrice;
        }
        
        this.renderCart();
    }

    renderCart() {
        this.cartEl.innerHTML = '';
        
        if (this.cart.length === 0) {
            this.emptyMsg.style.display = 'block';
            this.cartEl.appendChild(this.emptyMsg);
            this.cartTotalEl.textContent = '0.00 €';
            return;
        }
        
        this.emptyMsg.style.display = 'none';
        let total = 0;

        this.cart.forEach((item, idx) => {
            total += item.subtotal;
            
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.product.name}</div>
                    <div class="cart-item-price">${AppUtil.formatCurrency(item.product.salePrice)} c/u</div>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="window.salesApp.updateCartQty(${idx}, -1)">-</button>
                    <span style="font-weight:600; min-width: 20px; text-align:center;">${item.qty}</span>
                    <button class="qty-btn" onclick="window.salesApp.updateCartQty(${idx}, 1)" style="background:var(--primary-light);">+</button>
                </div>
            `;
            this.cartEl.appendChild(div);
        });

        this.cartTotalEl.textContent = AppUtil.formatCurrency(total);
    }

    saveSale() {
        const clientId = this.clientSelect.value;
        
        if (!clientId) {
            AppUtil.showToast("Debes seleccionar un cliente", "error");
            return;
        }
        if (this.cart.length === 0) {
            AppUtil.showToast("El carrito está vacío", "error");
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
        const costTotal = this.cart.reduce((sum, item) => sum + item.costSubtotal, 0);
        
        // Guardar snapshot de los items por si el producto original cambia después
        const itemsSnapshot = this.cart.map(i => ({
            productId: i.product.id,
            productName: i.product.name,
            qty: i.qty,
            unitPrice: i.product.salePrice,
            subtotal: i.subtotal
        }));

        const newSale = {
            clientId: clientId,
            date: new Date().toISOString(),
            items: itemsSnapshot,
            total: total,
            costTotal: costTotal,
            isPaid: this.isPaidCheckbox.checked,
            updatedAt: new Date().toISOString()
        };

        StorageService.addSale(newSale);
        AppUtil.showToast("Venta registrada correctamente", "success");
        
        this.fsModal.classList.remove('active');
        this.renderList();
    }

    openDetail(sale) {
        this.viewingSaleId = sale.id;
        
        const clients = StorageService.getClients();
        const client = clients.find(c => c.id === sale.clientId) || {name: 'Cliente Eliminado'};
        
        const content = document.getElementById('sdContent');
        
        let itemsHtml = sale.items.map(i => `
            <div style="display:flex; justify-content:space-between; font-size: 0.9rem; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span>${i.qty}x ${i.productName}</span>
                <span>${AppUtil.formatCurrency(i.subtotal)}</span>
            </div>
        `).join('');

        content.innerHTML = `
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px;">
                Fecha: ${AppUtil.formatDate(sale.date)}
            </div>
            <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 15px; color: var(--text-main);">
                Cliente: <span style="color:var(--primary-light);">${client.name}</span>
            </div>
            
            <div style="background: var(--bg-input); padding: 10px; border-radius: var(--radius-sm); margin-bottom: 15px;">
                ${itemsHtml}
                <div style="display:flex; justify-content:space-between; font-weight: 700; margin-top: 10px; font-size:1.1rem;">
                    <span>TOTAL:</span>
                    <span>${AppUtil.formatCurrency(sale.total)}</span>
                </div>
            </div>
            
            <div style="text-align:center;">
                Estado: 
                <span class="status-badge ${sale.isPaid ? 'status-paid' : 'status-pending'}" style="font-size: 0.85rem; padding: 4px 10px;">
                    ${sale.isPaid ? 'COBRADO' : 'PENDIENTE COBRO'}
                </span>
            </div>
        `;

        this.detailModal.classList.add('active');
    }

    toggleSalePaymentStatus() {
        if (!this.viewingSaleId) return;

        const sales = StorageService.getSales();
        const index = sales.findIndex(s => s.id === this.viewingSaleId);
        
        if (index > -1) {
            sales[index].isPaid = !sales[index].isPaid;
            sales[index].updatedAt = new Date().toISOString();
            StorageService.saveSales(sales);
            
            AppUtil.showToast(`Marcado como ${sales[index].isPaid ? 'Cobrado' : 'Pendiente'}`, 'success');
            this.openDetail(sales[index]); // Refresh detail view
            this.renderList(); // Refresh list behind
        }
    }

    renderList() {
        const sales = StorageService.getSales().sort((a,b) => new Date(b.date) - new Date(a.date)); // Mas nuevas primero
        const clients = StorageService.getClients();
        this.listEl.innerHTML = '';

        if (sales.length === 0) {
            this.listEl.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons-round" style="font-size: 64px; color: var(--border-color); margin-bottom: 15px;">receipt_long</span>
                    <h3>No hay ventas</h3>
                    <p style="margin-top: 5px;">Registra tu primera venta tocando el carrito.</p>
                </div>
            `;
            return;
        }

        sales.forEach(sale => {
            const client = clients.find(c => c.id === sale.clientId) || {name: 'Desconocido'};
            const itemsResumen = sale.items.map(i => `${i.qty}x ${i.productName}`).join(', ');
            
            const card = document.createElement('div');
            card.className = 'sale-card';
            
            card.innerHTML = `
                <div class="sale-info">
                    <span class="sale-date">${AppUtil.formatDate(sale.date)}</span>
                    <span class="sale-client">${client.name}</span>
                    <span class="sale-items">${itemsResumen.substring(0,40)}${itemsResumen.length>40?'...':''}</span>
                </div>
                <div class="sale-amount">
                    <div class="amount-val">${AppUtil.formatCurrency(sale.total)}</div>
                    <div class="status-badge ${sale.isPaid ? 'status-paid' : 'status-pending'}">
                        ${sale.isPaid ? 'COBRADO' : 'PENDIENTE'}
                    </div>
                </div>
            `;

            card.addEventListener('click', () => this.openDetail(sale));

            this.listEl.appendChild(card);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.salesApp = new SalesModule();
});
