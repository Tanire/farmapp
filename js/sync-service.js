const SyncService = {
    syncPromise: null,
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
            
            // Retrocompatibilidad con la version 1.0.0 y Parseo
            let parsed = JSON.parse(content);
            if(!parsed.users) parsed.users = {}; // Iniciar estructura multiusuario si no existe

            return parsed;
        } catch (e) {
            console.error("Error al obtener Gist:", e);
            throw e; 
        }
    },

    // ---- Manejo de Datos Locales ----
    
    getAllLocalData(sellerName = 'DEFAULT') {
        const local = {
            products: StorageService.getProducts(),
            users: {}
        };
        
        local.users[sellerName] = {
            clients: StorageService.getClients(),
            sales: StorageService.getSales()
        };

        return local;
    },

    restoreData(mergedData, sellerName) {
        // Restaurar productos (App global compartida)
        if (mergedData.products) StorageService.saveProducts(mergedData.products, true);
        
        // Restaurar solo clientes y ventas DE ESTE VENDEDOR (App sectorizada)
        if (mergedData.users && mergedData.users[sellerName]) {
             if (mergedData.users[sellerName].clients) StorageService.saveClients(mergedData.users[sellerName].clients, true);
             if (mergedData.users[sellerName].sales) StorageService.saveSales(mergedData.users[sellerName].sales, true);
        }
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
        if (this.syncPromise) {
            // En vez de lanzar un error, nos enganchamos ("cabalgamos") sobre la promesa que ya se está ejecutando
            // Así el usuario no ve errores molestos y la UI esperará a que el primer hilo termine felizmente.
            return this.syncPromise;
        }
        this.syncPromise = this._syncWithCloudCore(token, gistId);
        try {
            return await this.syncPromise;
        } finally {
            this.syncPromise = null;
        }
    },

    async _syncWithCloudCore(token, gistId) {
        // Usar Email como identificador de carpeta único para evitar fallos por nombres duplicados/erratas
        const sellerEmail = localStorage.getItem('farmapp_seller_email');
        if(!sellerEmail) return {success: false, error: 'Inicia sesión primero.'};

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
                // Si no hay nube generamos el primer esqueleto
                return await this.updateGist(token, gistId, this.getAllLocalData(sellerEmail));
            }

            const localData = this.getAllLocalData(sellerEmail);
            
            // Garantizar estructura de nube si es vieja (v1.0.0 a v1.1.0)
            if(!cloudData.users) cloudData.users = {};
            if(!cloudData.users[sellerEmail]) cloudData.users[sellerEmail] = { clients: [], sales: [] };

            // Realizamos el COMBINADO
            const mergedData = {
                products: this.mergeArrays(localData.products, cloudData.products),
                users: { ...cloudData.users } // Copiamos al resto de vendedores como estén
            };

            // Y ahora mergeamos únicamente el compartimento del vendedor local (Email)
            mergedData.users[sellerEmail] = {
                clients: this.mergeArrays(localData.users[sellerEmail].clients, cloudData.users[sellerEmail].clients),
                sales: this.mergeArrays(localData.users[sellerEmail].sales, cloudData.users[sellerEmail].sales)
            };

            // Guardamos localmente lo combinado (Solo productos y MIS clientes/ventas)
            this.restoreData(mergedData, sellerEmail);

            // Subimos TODO el ecosistema (Incluyendo a los otros vendedores) al Gist
            return await this.updateGist(token, gistId, mergedData);

        } catch (e) {
            return { success: false, error: e.message || 'Error de Sincronización Desconocido' };
        }
    }
};
