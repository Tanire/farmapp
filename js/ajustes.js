/**
 * Lógica para la pantalla de Ajustes
 */

document.addEventListener('DOMContentLoaded', () => {
    
    const sellerNameInput = document.getElementById('sellerName');
    const githubTokenInput = document.getElementById('githubToken');
    const gistIdInput = document.getElementById('gistId');
    const settingsForm = document.getElementById('settingsForm');
    const btnCreateGist = document.getElementById('btnCreateGist');
    const btnWipeData = document.getElementById('btnWipeData');

    // Cargar datos actuales
    sellerNameInput.value = localStorage.getItem('farmapp_seller_name') || '';
    githubTokenInput.value = localStorage.getItem('farmapp_github_token') || '';
    gistIdInput.value = localStorage.getItem('farmapp_gist_id') || '';

    // Guardar Configuración
    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const seller = sellerNameInput.value.trim().toUpperCase(); // Normalizar nombre
        const token = githubTokenInput.value.trim();
        const gist = gistIdInput.value.trim();

        if (seller && token) {
            const currentSeller = localStorage.getItem('farmapp_seller_name');
            
            // Si cambió de vendedor, limpiar BD local de clientes y ventas para no mochearlos
            if (currentSeller && currentSeller !== seller) {
                 const pass = confirm(`Vas a cambiar el perfil de "${currentSeller}" a "${seller}". Esto borrará tus clientes y ventas locales actuales para descargar los de ${seller}. ¿Continuar?`);
                 if (!pass) {
                     sellerNameInput.value = currentSeller;
                     return;
                 }
                 localStorage.removeItem('farmapp_clients');
                 localStorage.removeItem('farmapp_sales');
            }

            localStorage.setItem('farmapp_seller_name', seller);
            localStorage.setItem('farmapp_github_token', token);
            localStorage.setItem('farmapp_gist_id', gist);
            AppUtil.showToast('Configuración guardada.', 'success');
            
            // Disparar sincronización inmediata tras guardar
            window.dispatchEvent(new Event('farmapp_data_changed'));
        }
    });

    // Inicializar Gist (Subir Todo)
    btnCreateGist.addEventListener('click', async () => {
        const seller = sellerNameInput.value.trim().toUpperCase();
        const token = githubTokenInput.value.trim();
        
        if (!seller || !token) {
            AppUtil.showToast('Debes ingresar tu Vendedor y Token de GitHub', 'error');
            return;
        }

        const confirmCreate = confirm("Esto creará un nuevo archivo Gist en tu GitHub con los datos locales actuales de este dispositivo. ¿Estás seguro?");
        if (!confirmCreate) return;

        AppUtil.showToast('Creando Gist, espera...', 'success');
        
        try {
            const newGistId = await SyncService.createGist(token);
            if (newGistId) {
                gistIdInput.value = newGistId;
                localStorage.setItem('farmapp_gist_id', newGistId);
                AppUtil.showToast('¡Gist creado y sincronizado con éxito!', 'success');
            } else {
                AppUtil.showToast('Error al crear el Gist en GitHub.', 'error');
            }
        } catch (error) {
            AppUtil.showToast('Excepción al crear Gist.', 'error');
        }
    });

    // Limpiar Datos
    btnWipeData.addEventListener('click', () => {
        const pass = prompt('Esto borrará TODOS LOS DATOS LOCALES. Si no están en la nube, se perderán para siempre. Escribe "BORRAR" para confirmar.');
        if (pass === 'BORRAR') {
            localStorage.removeItem('farmapp_products');
            localStorage.removeItem('farmapp_clients');
            localStorage.removeItem('farmapp_sales');
            AppUtil.showToast('Datos locales borrados.', 'success');
        }
    });
});
