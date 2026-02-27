/**
 * Lógica para la pantalla de Ajustes
 */

document.addEventListener('DOMContentLoaded', () => {
    
    const githubTokenInput = document.getElementById('githubToken');
    const gistIdInput = document.getElementById('gistId');
    const settingsForm = document.getElementById('settingsForm');
    const btnCreateGist = document.getElementById('btnCreateGist');
    const btnWipeData = document.getElementById('btnWipeData');

    // Cargar datos actuales
    githubTokenInput.value = localStorage.getItem('farmapp_github_token') || '';
    gistIdInput.value = localStorage.getItem('farmapp_gist_id') || '';

    // Guardar Configuración
    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const token = githubTokenInput.value.trim();
        const gist = gistIdInput.value.trim();

        if (token) {
            localStorage.setItem('farmapp_github_token', token);
            localStorage.setItem('farmapp_gist_id', gist);
            AppUtil.showToast('Configuración guardada correctamente.', 'success');
        }
    });

    // Inicializar Gist (Subir Todo)
    btnCreateGist.addEventListener('click', async () => {
        const token = githubTokenInput.value.trim();
        if (!token) {
            AppUtil.showToast('Primero debes ingresar tu Token PAT de GitHub', 'error');
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
