/**
 * Módulo de Compras (Aprovisionamiento de Inventario FarmApp)
 */

class PurchasesModule {
    constructor() {
        // Elements
        this.listEl = document.getElementById('purchasesList');
        
        // Modal & Form Elements
        this.modal = document.getElementById('newPurchaseModal');
        this.productSelect = document.getElementById('purchaseProduct');
        this.btnAddProduct = document.getElementById('btnAddProduct');
        this.cartEl = document.getElementById('cartItems');
        this.cartEmptyMsg = document.getElementById('cartEmptyMsg');
        this.cartTotalVal = document.getElementById('cartTotalVal');
        this.btnSave = document.getElementById('btnSavePurchase');

        // State
        this.cart = [];

        this.bindEvents();
        this.renderList();
        this.populateSelects();
    }

    bindEvents() {
        // Open/Close
        document.getElementById('btnNewPurchase').addEventListener('click', () => {
            this.openModal();
        });

        document.getElementById('closePurchaseBtn').addEventListener('click', () => {
            this.closeModal();
        });

        // Add Product
        this.btnAddProduct.addEventListener('click', () => {
            this.addToCart();
        });

        // Save Purchase
        this.btnSave.addEventListener('click', () => {
            this.savePurchase();
        });

        // Modal Detalle
        const modalDet = document.getElementById('purchaseDetailModal');
        const closeModalBtn = document.getElementById('closeDetailBtn');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => modalDet.classList.remove('active'));
        }
        if (modalDet) {
            modalDet.addEventListener('click', (e) => {
                if (e.target === modalDet) modalDet.classList.remove('active');
            });
        }
    }

    populateSelects() {
        const sortedProducts = StorageService.getProducts().sort((a,b) => (a.name || '').localeCompare(b.name || ''));
        
        this.productSelect.innerHTML = '<option value="" disabled selected>Elegir producto...</option>';
        sortedProducts.forEach(prod => {
             const safeName = (prod.name || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
             this.productSelect.innerHTML += `<option value="${prod.id}">${safeName} (Fi: ${AppUtil.formatCurrency(prod.precioFi || 0)})</option>`;
        });
    }

    openModal() {
        this.cart = [];
        this.productSelect.value = '';
        this.renderCart();
        this.modal.classList.add('active');
        this.populateSelects(); // Refrescar por si crearon alguno
    }

    closeModal() {
        this.modal.classList.remove('active');
    }

    addToCart() {
        const prodId = this.productSelect.value;
        if (!prodId) {
            AppUtil.showToast('Selecciona un producto primero', 'error');
            return;
        }

        const product = StorageService.getProducts().find(p => p.id === prodId);
        if (!product) return;

        // Si ya está, aumentar cantidad
        const existing = this.cart.find(item => item.productId === prodId);
        if (existing) {
            existing.qty++;
        } else {
            this.cart.push({
                productId: product.id,
                name: product.name,
                precioFi: product.precioFi || 0,
                qty: 1
            });
        }

        this.productSelect.value = '';
        this.renderCart();
    }

    updateQty(index, delta) {
        this.cart[index].qty += delta;
        if (this.cart[index].qty <= 0) {
            this.cart.splice(index, 1);
        }
        this.renderCart();
    }

    renderCart() {
        this.cartEl.innerHTML = '';
        let total = 0;

        if (this.cart.length === 0) {
            this.cartEmptyMsg.style.display = 'block';
            this.cartTotalVal.textContent = AppUtil.formatCurrency(0);
            return;
        }

        this.cartEmptyMsg.style.display = 'none';

        this.cart.forEach((item, index) => {
            const sum = item.precioFi * item.qty;
            total += sum;

            const safeName = (item.name || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");

            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-name">${safeName}</div>
                    <span class="cart-item-price">${AppUtil.formatCurrency(item.precioFi)} c/u x ${item.qty} = <strong>${AppUtil.formatCurrency(sum)}</strong></span>
                </div>
                <div class="cart-item-controls">
                    <button type="button" class="qty-btn" onclick="purchasesApp.updateQty(${index}, -1)">-</button>
                    <span style="font-weight: 600; width: 25px; text-align: center;">${item.qty}</span>
                    <button type="button" class="qty-btn" onclick="purchasesApp.updateQty(${index}, 1)">+</button>
                </div>
            `;
            this.cartEl.appendChild(div);
        });

        this.cartTotalVal.textContent = AppUtil.formatCurrency(total);
    }

    savePurchase() {
        if (this.cart.length === 0) {
            AppUtil.showToast('El pedido está vacío', 'error');
            return;
        }

        let total = 0;
        this.cart.forEach(item => total += item.precioFi * item.qty);

        // Generar registro local (Almacenaremos array de PURCHASES en farmapp_purchases)
        const purchases = JSON.parse(localStorage.getItem('farmapp_purchases') || '[]');
        
        const newPurchase = {
            id: 'pur_' + Date.now().toString(36),
            date: new Date().toISOString(),
            totalFi: total,
            items: this.cart.map(i => ({...i}))
        };
        
        purchases.push(newPurchase);
        localStorage.setItem('farmapp_purchases', JSON.stringify(purchases));

        // -- SUMAR INVENTARIO MAGICO --
        const allProducts = StorageService.getProducts();
        this.cart.forEach(cartItem => {
            const pIndex = allProducts.findIndex(p => p.id === cartItem.productId);
            if (pIndex > -1) {
                const currentStock = Number(allProducts[pIndex].stock) || 0;
                // Sumar
                allProducts[pIndex].stock = currentStock + Number(cartItem.qty);
            }
        });
        
        StorageService.saveProducts(allProducts);

        AppUtil.showToast('Pedido Confirmado. Stock Incrementado.', 'success');
        this.closeModal();
        this.renderList();
        
        // Lanzar push to cloud
        window.dispatchEvent(new Event('farmapp_data_changed'));
    }

    renderList() {
        const purchases = JSON.parse(localStorage.getItem('farmapp_purchases') || '[]');
        this.listEl.innerHTML = '';

        if (purchases.length === 0) {
            this.listEl.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons-round" style="font-size: 64px; color: var(--border-color); margin-bottom: 15px;">inventory</span>
                    <h3>No has hecho pedidos reciéntemente</h3>
                    <p style="margin-top: 5px;">Los productos que pidas por aquí llenarán tu inventario virtual.</p>
                </div>
            `;
            return;
        }

        // Mostrar de más nuevo a más viejo
        const sorted = [...purchases].sort((a,b) => new Date(b.date) - new Date(a.date));

        sorted.forEach(p => {
            const card = document.createElement('div');
            card.className = 'purchase-card';
            
            const countStr = p.items.reduce((acc, curr) => acc + curr.qty, 0) + ' items';

            card.innerHTML = `
                <div class="purchase-info">
                    <span class="purchase-date">${AppUtil.formatDate(p.date)} -  ${new Date(p.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <span class="purchase-items" style="font-weight: 600;">Reabastecimiento de Central</span>
                    <span class="purchase-items">${countStr} añadidos al Stock</span>
                </div>
                <div class="purchase-amount" style="text-align: right;">
                    <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Inversión FI</div>
                    <div class="amount-val">${AppUtil.formatCurrency(p.totalFi)}</div>
                </div>
            `;

            // Click -> Ver detalles
            card.addEventListener('click', () => {
                const modal = document.getElementById('purchaseDetailModal');
                const content = document.getElementById('pdContent');
                
                let html = `
                    <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:15px;">Fecha: ${AppUtil.formatDate(p.date)} a las ${new Date(p.date).toLocaleTimeString()}</p>
                    <div style="background: var(--bg-input); border-radius: 8px; padding: 10px; margin-bottom: 20px;">
                        <h4 style="margin:0 0 10px 0; font-size:0.9rem; color:var(--text-muted);">Productos Sumados:</h4>
                        <ul style="list-style:none; padding:0; margin:0; font-size:0.9rem;">
                `;
                p.items.forEach(it => {
                     html += `<li style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 5px;">
                        <span style="flex:1;">${it.qty}x ${it.name}</span>
                        <span style="color:var(--secondary-light); margin-left:10px;">${AppUtil.formatCurrency(it.precioFi * it.qty)}</span>
                     </li>`;
                });
                html += `
                        </ul>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Inversión Incurrida</span>
                        <h3 style="margin:0; font-size:1.4rem; color: var(--danger);">${AppUtil.formatCurrency(p.totalFi || 0)}</h3>
                    </div>
                `;
                
                content.innerHTML = html;
                modal.classList.add('active');
            });

            this.listEl.appendChild(card);
        });
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    window.purchasesApp = new PurchasesModule();
});
