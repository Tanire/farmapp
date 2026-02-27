const SyncService = {
    // ---- GitHub Gist API Wrappers ----

    async createGist(token) {
        const data = {
            description: "FarmApp Data - Sync",
            public: false,
            files: {
                "farmapp_data.json": {
                    content: JSON.stringify(this.getAllLocalData())
                }
            }
        };

        try {
            const response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Error creando Gist');
            const json = await response.json();
            return json.id;
        } catch (e) {
            console.error('Error al crear el gist:', e);
            return null;
        }
    },

    async updateGist(token, gistId, dataContent) {
        const content = dataContent ? JSON.stringify(dataContent) : JSON.stringify(this.getAllLocalData());

        const data = {
            files: {
                "farmapp_data.json": { content: content }
            }
        };

        try {
            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
            return { success: true };
        } catch (e) {
            console.error('Error actualizando Gist:', e);
            return { success: false, error: e.message };
        }
    },

    async getGist(token, gistId) {
        try {
            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                cache: 'no-store' // Evitar caché en las lecturas críticas de nube
            });
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
            const json = await response.json();
            
            if (!json.files["farmapp_data.json"]) return null;

            const content = json.files["farmapp_data.json"].content;
            return JSON.parse(content);
        } catch (e) {
            console.error("Error al obtener Gist:", e);
            throw e; 
        }
    },

    // ---- Manejo de Datos Locales ----
    
    getAllLocalData() {
        return {
            products: StorageService.getProducts(),
            clients: StorageService.getClients(),
            sales: StorageService.getSales()
        };
    },

    restoreData(data) {
        if (data.products) StorageService.saveProducts(data.products, true);
        if (data.clients) StorageService.saveClients(data.clients, true);
        if (data.sales) StorageService.saveSales(data.sales, true);
    },

    mergeArrays(localArr, cloudArr) {
        const mergedMap = new Map();
        
        if (Array.isArray(cloudArr)) {
            cloudArr.forEach(item => { if (item && item.id) mergedMap.set(item.id, item); });
        }
        
        if (Array.isArray(localArr)) {
            localArr.forEach(localItem => {
                if (localItem && localItem.id) {
                    const cloudItem = mergedMap.get(localItem.id);
                    if (cloudItem) {
                        const localTime = localItem.updatedAt ? new Date(localItem.updatedAt).getTime() : 0;
                        const cloudTime = cloudItem.updatedAt ? new Date(cloudItem.updatedAt).getTime() : 0;
                        // El más reciente gana
                        if (localTime >= cloudTime) mergedMap.set(localItem.id, localItem);
                    } else {
                        mergedMap.set(localItem.id, localItem);
                    }
                }
            });
        }
        return Array.from(mergedMap.values());
    },

    async syncWithCloud(token, gistId) {
        try {
            let cloudData = null;
            try {
                cloudData = await this.getGist(token, gistId);
            } catch (e) {
                if (e.message.includes('404')) {
                    console.warn("Gist no encontrado, se creará o actualizará localmente.");
                } else {
                    return { success: false, error: e.message };
                }
            }

            if (!cloudData) {
                // Si no hay datos en nube pero sí ID, intentamos subir lo local
                return await this.updateGist(token, gistId);
            }

            const localData = this.getAllLocalData();

            // Mezclamos (Merge) usando las marcas de tiempo (updatedAt)
            const mergedData = {
                products: this.mergeArrays(localData.products, cloudData.products),
                clients: this.mergeArrays(localData.clients, cloudData.clients),
                sales: this.mergeArrays(localData.sales, cloudData.sales)
            };

            // Guardamos localmente lo combinado
            this.restoreData(mergedData);

            // Subimos la nueva versión al Gist
            return await this.updateGist(token, gistId, mergedData);

        } catch (e) {
            return { success: false, error: e.message || 'Error de Sincronización Desconocido' };
        }
    }
};
