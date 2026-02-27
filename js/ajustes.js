/**
 * Lógica para la pantalla de Ajustes
 */

document.addEventListener('DOMContentLoaded', () => {
    
    const sellerNameInput = document.getElementById('sellerName');
    const sellerEmailInput = document.getElementById('sellerEmail');
    const settingsForm = document.getElementById('settingsForm');
    const btnCreateGist = document.getElementById('btnCreateGist');
    const btnWipeData = document.getElementById('btnWipeData');
    
    // Elementos CSV
    const btnImportCSV = document.getElementById('btnImportCSV');
    const csvFileInput = document.getElementById('csvFileInput');

    // Elementos Administrador Nube
    const adminTokenInput = document.getElementById('adminToken');
    const adminGistInput = document.getElementById('adminGist');
    const btnSaveAdmin = document.getElementById('btnSaveAdmin');
    const btnWipeCatalog = document.getElementById('btnWipeCatalog');

    // Elementos Actualizador
    const localAppVersionDisplay = document.getElementById('localAppVersion');
    const cloudAppVersionDisplay = document.getElementById('cloudAppVersion');
    const btnForceUpdate = document.getElementById('btnForceUpdate');
    const CURRENT_LOCAL_VERSION = "v1.00.19"; // VARIABLE VIVA DE ACTUALIZACION DE APP

    // Cargar datos actuales
    sellerNameInput.value = localStorage.getItem('farmapp_seller_name') || '';
    sellerEmailInput.value = localStorage.getItem('farmapp_seller_email') || '';
    
    if (adminTokenInput) adminTokenInput.value = localStorage.getItem('farmapp_github_token') || '';
    if (adminGistInput) {
        const savedGist = localStorage.getItem('farmapp_gist_id');
        if (savedGist) adminGistInput.value = savedGist;
    }

    // Guardar Admin Nube
    if (btnSaveAdmin) {
        btnSaveAdmin.addEventListener('click', () => {
            const token = adminTokenInput.value.trim();
            const gist = adminGistInput.value.trim();
            
            if (token && gist) {
                localStorage.setItem('farmapp_github_token', token);
                localStorage.setItem('farmapp_gist_id', gist);
                AppUtil.showToast('Credenciales de Administrador Guardadas Secundariamente.', 'success');
            } else {
                AppUtil.showToast('Pon un Token y Gist válidos.', 'error');
            }
        });
    }

    // Purgar Catálogo (Admin)
    if (btnWipeCatalog) {
        btnWipeCatalog.addEventListener('click', () => {
            const count = StorageService.getProducts().length;
            if (count === 0) {
                 AppUtil.showToast('El catálogo ya está vacío.', 'error');
                 return;
            }
            
            const pass = prompt(`Vas a ELIMINAR LOS ${count} ARTÍCULOS de la base de datos de todos los vendedores. Escribe "PURGAR" en mayúsculas para confirmar.`);
            if (pass === 'PURGAR') {
                 const token = localStorage.getItem('farmapp_github_token');
                 const gistId = localStorage.getItem('farmapp_gist_id');
                 
                 if(!token || !gistId) {
                     AppUtil.showToast('Faltan credenciales de Administrador para Purgar la Nube.', 'error');
                     return;
                 }

                 AppUtil.showToast('Enviando orden de purga a la Nube...', 'success');
                 
                 SyncService.wipeCloudCatalog(token, gistId).then(res => {
                     if (res.success) {
                         StorageService.saveProducts([], true); // Guardar catálogo vacío local
                         AppUtil.showToast('Catálogo Global Purgado con Éxito.', 'success');
                         
                         // Notificar otras partes de la app para que repinten (ej. dashboard)
                         window.dispatchEvent(new Event('farmapp_data_changed')); 
                     } else {
                         AppUtil.showToast('Error purgando nube: ' + res.error, 'error');
                     }
                 });
            }
        });
    }

    // --- Módulo de Actualización Automática Integrada ---
    if (localAppVersionDisplay) {
        localAppVersionDisplay.textContent = CURRENT_LOCAL_VERSION;
    }
    
    // Buscar la versión de la nube y pintar
    async function checkCloudVersion() {
        if (!cloudAppVersionDisplay) return;
        try {
            // El ?t= bloquea el caché de la consulta
            const res = await fetch('version.json?t=' + new Date().getTime());
            if (res.ok) {
                const data = await res.json();
                cloudAppVersionDisplay.textContent = data.version;
                
                // Efecto visual si hay desactualizacion
                if (data.version !== CURRENT_LOCAL_VERSION) {
                    cloudAppVersionDisplay.style.color = '#ef4444'; // rojo
                    cloudAppVersionDisplay.innerHTML += ' ⚠️';
                } else {
                    cloudAppVersionDisplay.style.color = '#10b981'; // verde
                    cloudAppVersionDisplay.innerHTML += ' ✓';
                }
            } else {
                cloudAppVersionDisplay.textContent = 'Fuera de Línea';
            }
        } catch(e) {
            cloudAppVersionDisplay.textContent = 'Error';
        }
    }
    checkCloudVersion();

    if (btnForceUpdate) {
        btnForceUpdate.addEventListener('click', async () => {
             btnForceUpdate.disabled = true;
             btnForceUpdate.innerHTML = '<span class="material-icons-round" style="animation: spin 1s linear infinite;">autorenew</span> Purgando la Caché...';
             
             try {
                // 1. Desregistrar los Service Workers
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (let registration of registrations) {
                        await registration.unregister();
                    }
                }
                
                // 2. Borrar las Cachés almacenadas para forzar recarga por red entera
                if ('caches' in window) {
                    const keys = await caches.keys();
                    for (let key of keys) {
                        await caches.delete(key);
                    }
                }
                
                AppUtil.showToast("Caché borrada y app liberada. Reiniciando pantalla...", "success");
                
                // 3. Destruir y Regargar hardcoded
                setTimeout(() => {
                    window.location.reload(true);
                }, 1000);
             } catch(e) {
                 AppUtil.showToast("Error limpiando caché maestra: " + e.message, "error");
                 btnForceUpdate.disabled = false;
                 btnForceUpdate.innerHTML = '<span class="material-icons-round">autorenew</span> Sincronizar Caché de Versiones';
             }
        });
    }

    // Guardar Configuración
    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const seller = sellerNameInput.value.trim();
        const email = sellerEmailInput.value.trim().toLowerCase();

        if (seller && email) {
            const currentEmail = localStorage.getItem('farmapp_seller_email');
            
            // Si cambió de email, limpiar BD local de clientes y ventas
            if (currentEmail && currentEmail !== email) {
                 const pass = confirm(`Vas a cambiar tu sesión de "${currentEmail}" a "${email}". Esto borrará tus clientes locales para bajar los del nuevo correo. ¿Continuar?`);
                 if (!pass) {
                     sellerEmailInput.value = currentEmail;
                     return;
                 }
                 localStorage.removeItem('farmapp_clients');
                 localStorage.removeItem('farmapp_sales');
            }

            localStorage.setItem('farmapp_seller_name', seller);
            localStorage.setItem('farmapp_seller_email', email);
            AppUtil.showToast('Datos actualizados.', 'success');
            
            // Disparar sincronización
            window.dispatchEvent(new Event('farmapp_data_changed'));
        }
    });

    // Inicializar Gist (Forzar subida completa si fuese necesario)
    btnCreateGist.addEventListener('click', async () => {
        const email = sellerEmailInput.value.trim();
        
        if (!email) {
            AppUtil.showToast('Falta tu correo en ajustes', 'error');
            return;
        }

        const confirmCreate = confirm("Esto creará un nuevo archivo Gist en tu GitHub con los datos locales actuales de este dispositivo. ¿Estás seguro?");
        if (!confirmCreate) return;

        btnCreateGist.querySelector('.material-icons-round').style.color = 'var(--text-muted)';

        try {
            // Usando credenciales del administrador en el localStorage
            const token = localStorage.getItem('farmapp_github_token');
            const gistId = localStorage.getItem('farmapp_gist_id');
            
            if (!token || !gistId) {
                AppUtil.showToast('Configura primero las opciones de Administrador.', 'error');
                return;
            }
            
            const result = await SyncService.syncWithCloud(token, gistId);
            
            if (result.success) {
                AppUtil.showToast('¡Nube inicializada con éxito!', 'success');
            } else {
                AppUtil.showToast('Error: ' + result.error, 'error');
            }
        } catch(error) {
            AppUtil.showToast('Excepción al crear Gist.', 'error');
        }
    });

    // ---- IMPORTADOR CSV ----
    if (btnImportCSV && csvFileInput) {
        btnImportCSV.addEventListener('click', () => {
             csvFileInput.click(); // Abrir el file picker nativo
        });

        csvFileInput.addEventListener('change', (e) => {
             const file = e.target.files[0];
             if (!file) return;

             const reader = new FileReader();
             reader.onload = function(event) {
                 const text = event.target.result;
                 processCSV(text);
             };
             reader.readAsText(file, 'UTF-8');
             
             // Resetear el input por si sube el mismo archivo luego
             csvFileInput.value = '';
        });
    }

    function processCSV(csvText) {
        // Dividir por líneas compatibles con Windows y Mac (\r\n y \n)
        const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== '');
        
        let importedCount = 0;
        const currentProducts = StorageService.getProducts();

        lines.forEach((line, index) => {
             // Separar por comas (o punto y coma)
             let cols = line.split(';');
             // Si con punto y coma no saca al menos 2, probamos con coma normal
             if (cols.length < 2) cols = line.split(','); 
             
             // Si no tiene ni siquiera Clave y Nombre (2 columnas mínimo), saltamos la línea
             if (cols.length < 2) return; 

             // Limpieza y Extracción CLAVE, NOMBRE, PRECIO CATALOGO, PRECIO FI, DESCUENTO, PRECIO CLIENTE PROMOCIONAL, PRECIO FI PROMOCIONAL PUNTOS
             const clave = cols[0].trim();
             const name = cols[1].trim();
             
             // Los precios y descuentos pueden venir vacíos, con comas, símbolos de moneda, %, etc.
             function cleanNum(val) {
                 if(!val) return 0;
                 // Reemplaza coma por punto y extrae solo números y punto decimal
                 let parsed = parseFloat(val.toString().replace(/,/g, '.').replace(/[^\d.-]/g, ''));
                 return isNaN(parsed) ? 0 : parsed;
             }
             
             // El descuento a menudo viene como porcentaje "15%", lo limpiamos pero lo podemos dejar como "15" numérico o "15%" string. Lo pasaremos a número para manipularlo.
             function cleanTextOrNum(val) {
                 if(!val) return "";
                 return val.toString().trim();
             }

             const precioCatalogo = cleanNum(cols[2]);
             const precioFi = cleanNum(cols[3]);
             const descuento = cleanTextOrNum(cols[4]);
             const precioClientePromo = cleanNum(cols[5]);
             const precioFiPromoPuntos = cleanNum(cols[6]);

             // Ignorar cabeceras si las hay (ej. si la primera fila dice "NOMBRE", clave no debe estar vacía)
             if (clave && name && clave.toLowerCase() !== "clave") {
                  // Comprobar si ya existe uno con la MISMA CLAVE (Evitamos duplicar importaciones)
                  const existsIndex = currentProducts.findIndex(p => p.clave === clave);
                  
                  const newProduct = {
                       id: 'prod_' + Date.now().toString(36) + Math.random().toString(36).substr(2),
                       clave: clave,
                       name: name,
                       description: '', // Descripcion general si se quiere añadir después
                       precioCatalogo: precioCatalogo,
                       precioFi: precioFi,
                       descuento: descuento,
                       precioClientePromo: precioClientePromo,
                       precioFiPromoPuntos: precioFiPromoPuntos,
                       costPrice: 0, // Campos antiguos para evitar romper compras pasadas (Compatibilidad)
                       salePrice: precioCatalogo, 
                       stock: 0,
                       image: '',
                       updatedAt: new Date().toISOString()
                  };

                  if (existsIndex >= 0) {
                       // Si la clave ya existe, ACTUALIZAMOS LOS PRECIOS (útil para cuando pasan un CSV nuevo con tarifas actualizadas)
                       currentProducts[existsIndex] = {...currentProducts[existsIndex], ...newProduct, id: currentProducts[existsIndex].id, updatedAt: new Date().toISOString() }; // Mantener ID original viejo
                       importedCount++;
                  } else {
                       // Si es nuevo, se inserta
                       currentProducts.push(newProduct);
                       importedCount++;
                  }
             }
        });

        if (importedCount > 0) {
            StorageService.saveProducts(currentProducts, true); // True silencia el 'farmapp_data_changed' para no chocar
            AppUtil.showToast(`Se importaron / actualizaron ${importedCount} productos. Subiendo a GitHub...`, 'success');
            
            // Forzar una sincronización visible para que el usuario no cierre la web y vea que termina
            setTimeout(() => {
                if(window.app && window.app.handleManualSync) {
                    window.app.handleManualSync();
                }
            }, 500);
            
        } else {
            AppUtil.showToast('No se encontró ningún producto válido.', 'error');
        }
    }

    // Limpiar Datos
    btnWipeData.addEventListener('click', () => {
        const pass = prompt('Esto borrará TODOS LOS DATOS LOCALES. Si no están en la nube, se perderán para siempre. Escribe "BORRAR" para confirmar.');
        if (pass === 'BORRAR') {
            localStorage.removeItem('farmapp_products');
            localStorage.removeItem('farmapp_clients');
            localStorage.removeItem('farmapp_sales');
            localStorage.removeItem('farmapp_seller_name');
            localStorage.removeItem('farmapp_seller_email');
            localStorage.removeItem('farmapp_github_token');
            localStorage.removeItem('farmapp_gist_id');
            
            AppUtil.showToast('Sesión cerrada y datos borrados. Reiniciando...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        }
    });
});
