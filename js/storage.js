const StorageService = {
    // Funciones Base
    get(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(`farmapp_${key}`);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('Error parseando JSON del localStorage:', e);
            return defaultValue;
        }
    },

    set(key, value, forceUpdate = false) {
        if (!forceUpdate && Array.isArray(value)) {
           value = value.map(item => ({...item, updatedAt: item.updatedAt || new Date().toISOString()}));
        }
        localStorage.setItem(`farmapp_${key}`, JSON.stringify(value));
    },

    // --- Productos ---
    getProducts() {
        return this.get('products', []);
    },
    saveProducts(products, forceUpdate = false) {
        this.set('products', products, forceUpdate);
    },
    addProduct(product) {
        const products = this.getProducts();
        product.id = 'prod_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
        products.push(product);
        this.saveProducts(products);
        return product;
    },

    // --- Clientes ---
    getClients() {
        return this.get('clients', []);
    },
    saveClients(clients, forceUpdate = false) {
        this.set('clients', clients, forceUpdate);
    },
    addClient(client) {
        const clients = this.getClients();
        client.id = 'cli_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
        clients.push(client);
        this.saveClients(clients);
        return client;
    },

    // --- Ventas ---
    getSales() {
        return this.get('sales', []);
    },
    saveSales(sales, forceUpdate = false) {
        this.set('sales', sales, forceUpdate);
    },
    addSale(sale) {
        const sales = this.getSales();
        sale.id = 'sale_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
        sales.push(sale);
        this.saveSales(sales);
        return sale;
    }
};
