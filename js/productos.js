/**
 * Lógica del Módulo de Productos
 */

class ProductsModule {
    constructor() {
        this.listEl = document.getElementById('productsList');
        this.modal = document.getElementById('productModal');
        this.form = document.getElementById('productForm');
        this.imgInput = document.getElementById('prodImage');
        this.imgPreview = document.getElementById('imgPreview');
        this.searchInput = document.getElementById('searchProduct');
        
        // Data en vivo
        this.editingBase64Image = null;

        this.bindEvents();
        this.renderList();
    }

    bindEvents() {
        // Abrir Modal
        document.getElementById('btnNewProduct').addEventListener('click', () => {
            this.openModal();
        });

        // Cerrar Modal
        document.getElementById('closeModalBtn').addEventListener('click', () => {
            this.closeModal();
        });

        // Click fuera del modal lo cierra
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        // Manejo de imagen y compresión base64
        this.imgInput.addEventListener('change', (e) => this.handleImageUpload(e));

        // Submit Formulario
        this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Buscador
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.renderList(e.target.value);
            });
        }
    }

    openModal(prodData = null) {
        // Limpiar el form
        this.form.reset();
        this.imgPreview.style.display = 'none';
        this.imgPreview.src = '';
        this.editingBase64Image = null;
        document.getElementById('prodId').value = '';

        if (prodData) {
            document.getElementById('modalTitle').textContent = 'Editar Producto';
            document.getElementById('prodId').value = prodData.id;
            document.getElementById('prodClave').value = prodData.clave || '';
            document.getElementById('prodName').value = prodData.name || '';
            
            document.getElementById('prodCat').value = prodData.precioCatalogo || '';
            document.getElementById('prodFi').value = prodData.precioFi || '';
            document.getElementById('prodDesc').value = prodData.descuento || '';
            document.getElementById('prodPromo').value = prodData.precioClientePromo || '';
            document.getElementById('prodPromoPts').value = prodData.precioFiPromoPuntos || '';
            document.getElementById('prodStock').value = prodData.stock !== undefined ? prodData.stock : 0;
            
            if (prodData.image) {
                this.imgPreview.src = prodData.image;
                this.imgPreview.style.display = 'block';
                this.editingBase64Image = prodData.image;
            }
        } else {
            document.getElementById('modalTitle').textContent = 'Nuevo Producto';
        }

        this.modal.classList.add('active');
    }

    closeModal() {
        this.modal.classList.remove('active');
    }

    // Comprimir y convertir imagen a Base64
    handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // Redimensionar para no reventar el LocalStorage
                const MAX_WIDTH = 300;
                const MAX_HEIGHT = 300;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Calidad 0.7 para JPEG
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                
                this.imgPreview.src = dataUrl;
                this.imgPreview.style.display = 'block';
                this.editingBase64Image = dataUrl;
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    handleFormSubmit(e) {
        e.preventDefault();

        const id = document.getElementById('prodId').value;
        const clave = document.getElementById('prodClave').value.trim().toUpperCase();
        const name = document.getElementById('prodName').value.trim();
        
        const precioCatalogo = parseFloat(document.getElementById('prodCat').value) || 0;
        const precioFi = parseFloat(document.getElementById('prodFi').value) || 0;
        const descuento = document.getElementById('prodDesc').value.trim();
        const precioClientePromo = parseFloat(document.getElementById('prodPromo').value) || 0;
        const precioFiPromoPuntos = parseFloat(document.getElementById('prodPromoPts').value) || 0;
        const stock = parseInt(document.getElementById('prodStock').value) || 0;

        // -- VALIDACION: CLAVE UNICA -- 
        // Si hay clave, comprobar que no esté pillada por otro ID distinto
        if (clave !== '') {
            const currentProds = StorageService.getProducts();
            const exists = currentProds.some(p => p.clave === clave && p.id !== id);
            if (exists) {
                AppUtil.showToast(`Error: La clave "${clave}" ya existe en otro producto.`, "error");
                return; // Cortar el guardado
            }
        }

        const newProd = {
            id: id || 'prod_' + Date.now().toString(36) + Math.random().toString(36).substr(2),
            clave,
            name,
            precioCatalogo,
            precioFi,
            descuento,
            precioClientePromo,
            precioFiPromoPuntos,
            stock,
            description: '',
            costPrice: 0, // deprecado pero conservado por seguridad
            salePrice: precioCatalogo, // Mantener compatibilidad con ventas si es necesario
            image: this.editingBase64Image,
            updatedAt: new Date().toISOString()
        };

        if (id) {
            // Actualizar
            const prods = StorageService.getProducts();
            const index = prods.findIndex(p => p.id === id);
            if (index > -1) {
                prods[index] = newProd;
                StorageService.saveProducts(prods);
                AppUtil.showToast("Producto actualizado", "success");
            }
        } else {
            // Nuevo
            StorageService.addProduct(newProd);
            AppUtil.showToast("Producto creado", "success");
        }

        this.closeModal();
        this.renderList();
    }

    renderList(searchTerm = '') {
        const products = StorageService.getProducts();
        this.listEl.innerHTML = '';
        
        let filteredProducts = products;
        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase().trim();
            // Buscar en Nombre o en Clave
            filteredProducts = products.filter(p => 
                (p.name || '').toLowerCase().includes(term) ||
                (p.clave || '').toLowerCase().includes(term)
            );
        }

        if (filteredProducts.length === 0) {
            this.listEl.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons-round" style="font-size: 64px; color: var(--border-color); margin-bottom: 15px;">search_off</span>
                    <h3>Ningún producto encontrado</h3>
                    <p style="margin-top: 5px;">Carga productos o intenta buscar con otras palabras.</p>
                </div>
            `;
            return;
        }

        filteredProducts.forEach(prod => {
            const card = document.createElement('div');
            card.className = 'product-card';
            
            const safeName = (prod.name || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const safeClave = (prod.clave || 'S/C').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            const imgSrc = prod.image ? prod.image : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='%2394A3B8'><path d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/></svg>";

            card.innerHTML = `
                <img src="${imgSrc}" class="product-img" alt="${safeName}">
                <div class="product-info" style="width: 100%;">
                    <div style="display:flex; justify-content: space-between; align-items:flex-start;">
                        <span class="product-title">${safeName}</span>
                        <span style="font-size: 0.7rem; color: var(--text-muted); background: var(--bg-input); padding: 2px 6px; border-radius: 4px;">${safeClave}</span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 5px; font-size: 0.75rem;">
                        <div style="color: var(--text-muted);">Catálogo: <strong style="color: var(--text-main);">${AppUtil.formatCurrency(prod.precioCatalogo || prod.salePrice)}</strong></div>
                        <div style="color: var(--text-muted);">P. FI: <strong style="color: var(--secondary-light);">${AppUtil.formatCurrency(prod.precioFi || 0)}</strong></div>
                        
                        <div style="color: var(--text-muted);">Promo: <strong style="color: var(--accent);">${AppUtil.formatCurrency(prod.precioClientePromo || 0)}</strong></div>
                        <div style="color: var(--text-muted);">Promo FI: <strong style="color: var(--accent);">${AppUtil.formatCurrency(prod.precioFiPromoPuntos || 0)}</strong></div>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; font-size: 0.8rem;">
                        ${prod.descuento ? `<div style="color: var(--primary-light);">Desc: <strong>${prod.descuento.toString().includes('%') ? prod.descuento : prod.descuento + '%'}</strong></div>` : '<div></div>'}
                        <div style="background: ${prod.stock <= 0 ? 'var(--danger)' : 'var(--bg-main)'}; color: ${prod.stock <= 0 ? 'white' : 'var(--text-main)'}; padding: 2px 8px; border-radius: 12px; font-weight: 600;">Stock: ${prod.stock || 0}</div>
                    </div>
                </div>
                <button class="icon-btn edit-btn" style="color: var(--primary-light);">
                    <span class="material-icons-round">edit</span>
                </button>
            `;

            // Edición
            const editBtn = card.querySelector('.edit-btn');
            editBtn.addEventListener('click', () => this.openModal(prod));

            this.listEl.appendChild(card);
        });
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    window.productsApp = new ProductsModule();
});
