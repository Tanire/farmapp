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
            document.getElementById('prodName').value = prodData.name;
            document.getElementById('prodDesc').value = prodData.description || '';
            document.getElementById('prodCost').value = prodData.costPrice;
            document.getElementById('prodPrice').value = prodData.salePrice;
            document.getElementById('prodId').value = prodData.id;
            
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
        const name = document.getElementById('prodName').value;
        const description = document.getElementById('prodDesc').value;
        const costPrice = parseFloat(document.getElementById('prodCost').value);
        const salePrice = parseFloat(document.getElementById('prodPrice').value);

        const newProd = {
            id: id || undefined,
            name,
            description,
            costPrice,
            salePrice,
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

    renderList() {
        const products = StorageService.getProducts();
        this.listEl.innerHTML = '';

        if (products.length === 0) {
            this.listEl.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons-round" style="font-size: 64px; color: var(--border-color); margin-bottom: 15px;">inventory_2</span>
                    <h3>No tienes productos</h3>
                    <p style="margin-top: 5px;">Toca el botón + para añadir tu primer artículo de venta.</p>
                </div>
            `;
            return;
        }

        products.forEach(prod => {
            const card = document.createElement('div');
            card.className = 'product-card';
            
            // Imagen Placeholder si no hay
            const imgSrc = prod.image || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="%2394A3B8"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';

            card.innerHTML = `
                <img src="${imgSrc}" class="product-img" alt="${prod.name}">
                <div class="product-info">
                    <div class="product-title">${prod.name}</div>
                    <div class="product-desc">${prod.description}</div>
                    <div class="product-price-row">
                        <span class="price-chip price-chip-cost">Coste: ${AppUtil.formatCurrency(prod.costPrice)}</span>
                        <span class="price-chip">Venta: ${AppUtil.formatCurrency(prod.salePrice)}</span>
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
