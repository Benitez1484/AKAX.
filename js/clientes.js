// js/clientes.js - CON SEGURIDAD (ADS20)
import { db, collection, addDoc, doc, updateDoc, deleteDoc } from './firebase-config.js';
import { cargarClientes, mostrarToast, verificarConexion, reintentarConexion } from './common.js';

let clientesGlobal = [];
let clientesFiltrados = [];

// 🔒 CONFIGURACIÓN DE SEGURIDAD
const PASS_ADMIN = "ADS20";

function verificarPermisoAdmin() {
    const input = prompt("🔒 SEGURIDAD REQUERIDA\n\nPor favor, ingrese la contraseña de administrador para continuar:");
    if (input === PASS_ADMIN) {
        return true;
    } else {
        mostrarToast('⛔ Contraseña incorrecta. Acceso denegado.', 'error', true);
        return false;
    }
}

// ==================== INICIALIZACIÓN ====================
window.reintentarConexionManual = async function() {
    await reintentarConexion();
    await cargarTablaClientes();
};

document.addEventListener('DOMContentLoaded', async () => {
    configurarMenu(); // Menú hamburguesa
    const conectado = await verificarConexion();
    
    if (conectado) {
        await cargarTablaClientes();
        configurarEventos();
    } else {
        document.getElementById('clientesTable').innerHTML = 
            '<tr><td colspan="5" class="text-center" style="color: var(--color-danger);">❌ Error de conexión. Verifica tu configuración de Firebase.</td></tr>';
    }
});

function configurarEventos() {
    document.getElementById('btnNuevoCliente').addEventListener('click', abrirModalNuevo);
    document.getElementById('btnCerrarModal').addEventListener('click', cerrarModalNuevo);
    document.getElementById('btnCancelarCliente').addEventListener('click', cerrarModalNuevo);
    document.getElementById('btnGuardarCliente').addEventListener('click', guardarCliente);
    document.getElementById('btnCerrarModalEditar').addEventListener('click', cerrarModalEditar);
    document.getElementById('btnCancelarEditar').addEventListener('click', cerrarModalEditar);
    document.getElementById('btnActualizarCliente').addEventListener('click', actualizarCliente);
    document.getElementById('searchClientes').addEventListener('input', filtrarClientes);
}

// ==================== LÓGICA DE DATOS ====================

async function cargarTablaClientes() {
    const tbody = document.getElementById('clientesTable');
    
    try {
        clientesGlobal = await cargarClientes();
        clientesFiltrados = [...clientesGlobal];
        
        document.getElementById('totalClientes').textContent = clientesGlobal.length;
        
        if (clientesGlobal.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay clientes registrados</td></tr>';
            return;
        }
        
        renderizarTabla(clientesGlobal);
        
    } catch (error) {
        console.error('Error al cargar clientes:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="color: var(--color-danger);">Error al cargar clientes</td></tr>';
        mostrarToast('Error al cargar clientes: ' + error.message, 'error');
    }
}

function renderizarTabla(clientes) {
    const tbody = document.getElementById('clientesTable');
    
    if (clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No se encontraron clientes</td></tr>';
        return;
    }
    
    tbody.innerHTML = clientes.map(cliente => `
        <tr>
            <td style="font-weight: 600;">${cliente.nombre || 'N/A'}</td>
            <td>${cliente.telefono || '-'}</td>
            <td>${cliente.email || '-'}</td>
            <td>${cliente.direccion || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon btn-edit" onclick="editarCliente('${cliente.id}')" title="Editar">
                        ✏️
                    </button>
                    <button class="btn-icon btn-delete" onclick="eliminarCliente('${cliente.id}', '${escapeHtml(cliente.nombre)}')" title="Eliminar">
                        🗑️
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function filtrarClientes() {
    const searchTerm = document.getElementById('searchClientes').value.toLowerCase();
    
    if (!searchTerm) {
        clientesFiltrados = [...clientesGlobal];
    } else {
        clientesFiltrados = clientesGlobal.filter(cliente =>
            (cliente.nombre?.toLowerCase().includes(searchTerm)) ||
            (cliente.telefono?.includes(searchTerm)) ||
            (cliente.email?.toLowerCase().includes(searchTerm))
        );
    }
    
    renderizarTabla(clientesFiltrados);
    document.getElementById('totalClientes').textContent = clientesFiltrados.length;
}

// ==================== NUEVO CLIENTE (Sin contraseña) ====================
function abrirModalNuevo() {
    limpiarFormularioNuevo();
    document.getElementById('modalCliente').classList.add('active');
}

function cerrarModalNuevo() {
    document.getElementById('modalCliente').classList.remove('active');
    limpiarFormularioNuevo();
}

function limpiarFormularioNuevo() {
    document.getElementById('clienteNombre').value = '';
    document.getElementById('clienteTelefono').value = '';
    document.getElementById('clienteEmail').value = '';
    document.getElementById('clienteDireccion').value = '';
}

async function guardarCliente() {
    const nombre = document.getElementById('clienteNombre').value.trim();
    const telefono = document.getElementById('clienteTelefono').value.trim();
    const email = document.getElementById('clienteEmail').value.trim();
    const direccion = document.getElementById('clienteDireccion').value.trim();
    
    if (!nombre) {
        mostrarToast('El nombre del cliente es requerido', 'error');
        document.getElementById('clienteNombre').focus();
        return;
    }
    
    if (!telefono) {
        mostrarToast('El teléfono del cliente es requerido', 'error');
        document.getElementById('clienteTelefono').focus();
        return;
    }
    
    const btn = document.getElementById('btnGuardarCliente');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = 'Guardando...';
    btn.disabled = true;

    try {
        await addDoc(collection(db, "clientes"), {
            nombre: nombre,
            telefono: telefono,
            email: email,
            direccion: direccion,
            fechaRegistro: new Date()
        });
        
        mostrarToast('¡Cliente registrado exitosamente!', 'success', true);
        cerrarModalNuevo();
        await cargarTablaClientes();
        
    } catch (error) {
        console.error('Error al guardar cliente:', error);
        mostrarToast('Error al guardar el cliente: ' + error.message, 'error');
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
}

// ==================== EDITAR CLIENTE (Con Contraseña) ====================
window.editarCliente = function(id) {
    const cliente = clientesGlobal.find(c => c.id === id);
    if (!cliente) {
        mostrarToast('Cliente no encontrado', 'error');
        return;
    }
    
    document.getElementById('editClienteIdHidden').value = cliente.id;
    document.getElementById('editNombre').value = cliente.nombre || '';
    document.getElementById('editTelefono').value = cliente.telefono || '';
    document.getElementById('editEmail').value = cliente.email || '';
    document.getElementById('editDireccion').value = cliente.direccion || '';
    
    document.getElementById('modalEditarCliente').classList.add('active');
};

function cerrarModalEditar() {
    document.getElementById('modalEditarCliente').classList.remove('active');
}

async function actualizarCliente() {
    const clienteId = document.getElementById('editClienteIdHidden').value;
    const nombre = document.getElementById('editNombre').value.trim();
    const telefono = document.getElementById('editTelefono').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const direccion = document.getElementById('editDireccion').value.trim();
    
    if (!nombre) {
        mostrarToast('El nombre del cliente es requerido', 'error');
        document.getElementById('editNombre').focus();
        return;
    }
    
    // 🔒 VERIFICAR CONTRASEÑA ANTES DE GUARDAR
    if (!verificarPermisoAdmin()) return;
    
    const btn = document.getElementById('btnActualizarCliente');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = 'Guardando...';
    btn.disabled = true;

    try {
        const clienteRef = doc(db, 'clientes', clienteId);
        await updateDoc(clienteRef, {
            nombre: nombre,
            telefono: telefono,
            email: email,
            direccion: direccion,
            fechaModificacion: new Date()
        });
        
        mostrarToast('¡Cliente actualizado exitosamente!', 'success', true);
        cerrarModalEditar();
        await cargarTablaClientes();
        
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        mostrarToast('Error al actualizar el cliente: ' + error.message, 'error');
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
}

// ==================== ELIMINAR CLIENTE (Con Contraseña) ====================
window.eliminarCliente = async function(id, nombre) {
    const nombreDecodificado = nombre.replace(/&quot;/g, '"')
                                     .replace(/&#039;/g, "'")
                                     .replace(/&amp;/g, '&')
                                     .replace(/&lt;/g, '<')
                                     .replace(/&gt;/g, '>');
    
    const confirmar = confirm(
        `¿Estás seguro de eliminar al cliente "${nombreDecodificado}"?\n\n` +
        `⚠️ ADVERTENCIA: Esta acción no se puede deshacer.`
    );
    
    if (!confirmar) return;

    // 🔒 VERIFICAR CONTRASEÑA ANTES DE ELIMINAR
    if (!verificarPermisoAdmin()) return;
    
    try {
        await deleteDoc(doc(db, 'clientes', id));
        mostrarToast('Cliente eliminado correctamente', 'success', true);
        await cargarTablaClientes();
        
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        mostrarToast('Error al eliminar el cliente: ' + error.message, 'error');
    }
};

// ==================== MENÚ ====================
function configurarMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const navSidebar = document.getElementById('navSidebar');
    const navOverlay = document.getElementById('navOverlay');
    const sidebarLinks = document.querySelectorAll('.nav-sidebar-link');
    
    if (!menuToggle) return;

    function toggle() {
        menuToggle.classList.toggle('active');
        navSidebar.classList.toggle('active');
        navOverlay?.classList.toggle('active');
    }

    menuToggle.addEventListener('click', toggle);
    navOverlay?.addEventListener('click', toggle);
    sidebarLinks.forEach(link => link.addEventListener('click', toggle));
    
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const markActive = (links) => {
        links.forEach(link => {
            const linkPage = link.getAttribute('href');
            if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
                link.classList.add('active');
            }
        });
    };
    markActive(sidebarLinks);
    markActive(document.querySelectorAll('.nav-link'));
}