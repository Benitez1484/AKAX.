// js/common.js - VERSIÓN SIN TOASTS MOLESTOS
import { db, collection, getDocs, query, orderBy } from './firebase-config.js';

// ==================== ESTADO DE CONEXIÓN ====================
let estadoConexion = {
    conectado: false,
    intentando: true,
    error: null
};

// Verificar conexión a Firebase
export async function verificarConexion() {
    const indicador = document.getElementById('connectionIndicator');
    const statusText = document.getElementById('connectionStatus');
    const statusIcon = document.getElementById('connectionIcon');
    const detailStatus = document.getElementById('detailStatus');
    
    if (!indicador) return;
    
    try {
        // Intentar conectar
        indicador.className = 'connection-indicator connecting';
        if (statusText) statusText.textContent = 'Conectando...';
        if (statusIcon) statusIcon.textContent = '⏳';
        if (detailStatus) detailStatus.textContent = 'Verificando conexión...';
        
        // Hacer una consulta simple para verificar conexión
        const testQuery = query(collection(db, "clientes"));
        await getDocs(testQuery);
        
        // Conexión exitosa
        estadoConexion.conectado = true;
        estadoConexion.intentando = false;
        estadoConexion.error = null;
        
        indicador.className = 'connection-indicator connected';
        if (statusText) statusText.textContent = 'Conectado';
        if (statusIcon) statusIcon.textContent = '✅';
        if (detailStatus) detailStatus.textContent = 'Conexión establecida correctamente';
        
        // SIN TOAST - Solo actualizar indicador
        return true;
    } catch (error) {
        // Error de conexión
        estadoConexion.conectado = false;
        estadoConexion.intentando = false;
        estadoConexion.error = error.message;
        
        indicador.className = 'connection-indicator disconnected';
        if (statusText) statusText.textContent = 'Desconectado';
        if (statusIcon) statusIcon.textContent = '❌';
        if (detailStatus) detailStatus.textContent = `Error: ${error.message}`;
        
        console.error('Error de conexión a Firebase:', error);
        // SIN TOAST - Solo actualizar indicador
        return false;
    }
}

// Obtener estado actual de conexión
export function obtenerEstadoConexion() {
    return estadoConexion;
}

// Reintentar conexión
export async function reintentarConexion() {
    const detailStatus = document.getElementById('detailStatus');
    if (detailStatus) detailStatus.textContent = 'Reintentando conexión...';
    return await verificarConexion();
}

// ==================== SISTEMA DE NOTIFICACIONES (SOLO IMPORTANTES) ====================
export function mostrarToast(mensaje, tipo = 'info', forzar = false) {
    // Solo mostrar toasts para errores y validaciones (forzar = true)
    // Ignorar mensajes de éxito automáticos de Firebase
    if (!forzar && (tipo === 'success' || tipo === 'info')) {
        console.log(`[${tipo.toUpperCase()}] ${mensaje}`);
        return; // No mostrar toast, solo en consola
    }
    
    // Crear contenedor de toasts si no existe
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Crear toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo} toast-show`;
    
    const iconos = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${iconos[tipo] || 'ℹ️'}</span>
        <span class="toast-message">${mensaje}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">✖</button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto-cerrar después de 5 segundos
    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Función especial para mensajes de validación (SIEMPRE se muestran)
export function mostrarError(mensaje) {
    mostrarToast(mensaje, 'error', true);
}

// Función especial para advertencias (SIEMPRE se muestran)
export function mostrarAdvertencia(mensaje) {
    mostrarToast(mensaje, 'warning', true);
}

// ==================== FUNCIONES ORIGINALES ====================
// Función para cargar clientes
export async function cargarClientes() {
    try {
        const q = query(collection(db, "clientes"), orderBy("nombre"));
        const querySnapshot = await getDocs(q);
        const clientes = [];
        querySnapshot.forEach((doc) => {
            clientes.push({ id: doc.id, ...doc.data() });
        });
        return clientes;
    } catch (error) {
        console.error("Error al cargar clientes:", error);
        mostrarError('Error al cargar clientes: ' + error.message);
        return [];
    }
}

// Función para cargar ventas
export async function cargarVentas() {
    try {
        const q = query(collection(db, "ventas"), orderBy("fecha", "desc"));
        const querySnapshot = await getDocs(q);
        const ventas = [];
        querySnapshot.forEach((doc) => {
            ventas.push({ id: doc.id, ...doc.data() });
        });
        return ventas;
    } catch (error) {
        console.error("Error al cargar ventas:", error);
        mostrarError('Error al cargar ventas: ' + error.message);
        return [];
    }
}

// Función para formatear fecha
export function formatearFecha(fecha) {
    if (!fecha) return '';
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return date.toLocaleDateString('es-GT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// Función para calcular estadísticas
export function calcularEstadisticas(ventas) {
    const totalVentas = ventas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
    const cantidadTotal = ventas.reduce((sum, v) => sum + parseFloat(v.cantidad || 0), 0);
    
    return {
        totalVentas: totalVentas.toFixed(2),
        numeroVentas: ventas.length,
        cantidadTotal: cantidadTotal.toFixed(2),
        promedioVenta: ventas.length > 0 ? (totalVentas / ventas.length).toFixed(2) : '0.00'
    };
}

// Función para mostrar mensajes (mantener compatibilidad pero sin toast)
export function mostrarMensaje(mensaje, tipo = 'success') {
    console.log(`[${tipo.toUpperCase()}] ${mensaje}`);
    // No mostrar toast, solo log en consola
}

// Función para validar campo (SIEMPRE muestra error)
export function validarCampo(valor, nombreCampo) {
    if (!valor || valor.trim() === '') {
        mostrarError(`El campo ${nombreCampo} es requerido`);
        return false;
    }
    return true;
}