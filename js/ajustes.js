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

    // Cargar datos actuales
    sellerNameInput.value = localStorage.getItem('farmapp_seller_name') || '';
    sellerEmailInput.value = localStorage.getItem('farmapp_seller_email') || '';

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
            // Usando constantes globales incrustadas en main.js
            const token = GITHUB_TOKEN;
            const gistId = GITHUB_GIST_ID;
            
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
                       image: ''
                  };

                  if (existsIndex >= 0) {
                       // Si la clave ya existe, ACTUALIZAMOS LOS PRECIOS (útil para cuando pasan un CSV nuevo con tarifas actualizadas)
                       currentProducts[existsIndex] = {...currentProducts[existsIndex], ...newProduct, id: currentProducts[existsIndex].id }; // Mantener ID original viejo
                       importedCount++;
                  } else {
                       // Si es nuevo, se inserta
                       currentProducts.push(newProduct);
                       importedCount++;
                  }
             }
        });

        if (importedCount > 0) {
            StorageService.saveProducts(currentProducts);
            AppUtil.showToast(`Se importaron / actualizaron ${importedCount} productos.`, 'success');
        } else {
            AppUtil.showToast('No se encontró ningún producto válido o el archivo no tiene 7 columnas.', 'error');
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
            
            AppUtil.showToast('Sesión cerrada y datos borrados. Reiniciando...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        }
    });
});
