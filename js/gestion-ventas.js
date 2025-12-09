// js/gestion-ventas.js - CON CONTRASEÑA DE SEGURIDAD (ADS20)
// ==================== CONTROL DEL MENÚ HAMBURGUESA ====================
document.addEventListener('DOMContentLoaded', () => {
    configurarMenu();
});

function configurarMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const navSidebar = document.getElementById('navSidebar');
    const navOverlay = document.getElementById('navOverlay');
    const sidebarLinks = document.querySelectorAll('.nav-sidebar-link');
    
    function abrirMenu() {
        menuToggle.classList.add('active');
        navSidebar.classList.add('active');
        navOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    function cerrarMenu() {
        menuToggle.classList.remove('active');
        navSidebar.classList.remove('active');
        navOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            if (navSidebar.classList.contains('active')) {
                cerrarMenu();
            } else {
                abrirMenu();
            }
        });
    }
    
    if (navOverlay) navOverlay.addEventListener('click', cerrarMenu);
    
    sidebarLinks.forEach(link => {
        link.addEventListener('click', cerrarMenu);
    });
    
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Marcar activo en sidebar y desktop
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

// ==================== GESTIÓN DE VENTAS ====================
import { db, doc, updateDoc, deleteDoc } from './firebase-config.js';
import { cargarVentas, cargarClientes, formatearFecha, verificarConexion, reintentarConexion, mostrarToast } from './common.js';

let ventasGlobal = [];
let clientesGlobal = [];
let ventaActual = null;

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

const CONFIG_NEGOCIO = {
    nombre: "AKAX",
    slogan: "Hongos Pajomel - Cultivando calidad, cosechando confianza",
    direccion: "Santa Cruz La Laguna, Sololá",
    telefono: "+502 3709-4662",
    logoPath: "assets/Logo-final.png"
};

window.reintentarConexionManual = async function() {
    await reintentarConexion();
    await cargarDatos();
};

document.addEventListener('DOMContentLoaded', async () => {
    const conectado = await verificarConexion();
    
    if (conectado) {
        await cargarDatos();
        configurarEventos();
    } else {
        mostrarToast('Error de conexión. Verifica tu configuración de Firebase.', 'error');
    }
});

async function cargarDatos() {
    try {
        ventasGlobal = await cargarVentas();
        clientesGlobal = await cargarClientes();
        
        cargarTablaVentas(ventasGlobal);
        cargarSelectClientes();
        
        document.getElementById('totalVentas').textContent = ventasGlobal.length;
    } catch (error) {
        console.error('Error al cargar datos:', error);
        mostrarToast('Error al cargar datos: ' + error.message, 'error');
    }
}

function cargarSelectClientes() {
    const select = document.getElementById('editClienteId');
    if(!select) return;
    
    select.innerHTML = '<option value="">Seleccionar cliente</option>';
    
    clientesGlobal.forEach(cliente => {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = cliente.nombre;
        select.appendChild(option);
    });
}

function configurarEventos() {
    document.getElementById('searchInput').addEventListener('input', aplicarFiltros);
    document.getElementById('btnFiltrar').addEventListener('click', aplicarFiltros);
    document.getElementById('btnLimpiar').addEventListener('click', limpiarFiltros);
    document.getElementById('btnGuardarEdicion').addEventListener('click', guardarEdicion);
    document.getElementById('btnGuardarPago').addEventListener('click', registrarPago);
    document.getElementById('btnGenerarRecibo').addEventListener('click', generarReciboPDFGlobal);
    document.getElementById('btnEditarDesdeDetalle').addEventListener('click', editarVentaGlobal);
    
    // Filtros rápidos
    document.querySelectorAll('.btn-quick-filter').forEach(btn => {
        btn.addEventListener('click', (e) => aplicarFiltroRapido(btn.dataset.filter, e));
    });
    
    const inputFecha = document.getElementById('editFechaVenta');
    if (inputFecha) {
        const hoy = new Date().toISOString().split('T')[0];
        inputFecha.setAttribute('max', hoy);
    }
    
    ['editCantidad', 'editPrecioUnitario', 'editDescuento'].forEach(id => {
        document.getElementById(id).addEventListener('input', calcularTotalesEdicion);
    });
    
    document.getElementById('btnExportar').addEventListener('click', exportarVentas);
}

function cargarTablaVentas(ventas) {
    const tbody = document.getElementById('ventasTable');
    
    if (ventas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 3rem; color: var(--color-text-light);">📭 No hay ventas que coincidan con los filtros</td></tr>';
        return;
    }
    
    tbody.innerHTML = ventas.map(venta => {
        const montoPagado = parseFloat(venta.montoPagado || 0);
        const saldoPendiente = parseFloat(venta.saldoPendiente || venta.total || 0);
        const total = parseFloat(venta.total || 0);
        
        return `
        <tr>
            <td style="white-space: nowrap; font-size: 0.9rem;">${formatearFecha(venta.fecha)}</td>
            <td style="font-weight: 500;">${venta.clienteNombre || 'N/A'}</td>
            <td>${venta.tipoHongo || 'N/A'}</td>
            <td>${parseFloat(venta.cantidad || 0).toFixed(2)} ${venta.unidadMedida || ''}</td>
            <td>
                <div class="total-con-detalle">
                    <span class="total-principal">Q${total.toFixed(2)}</span>
                    ${venta.estadoPago === 'Parcial' ? `
                        <span class="total-detalle parcial">💰 Pagado: Q${montoPagado.toFixed(2)}</span>
                        <span class="total-detalle parcial">⏳ Debe: Q${saldoPendiente.toFixed(2)}</span>
                    ` : ''}
                    ${venta.estadoPago === 'Pendiente' ? `
                        <span class="total-detalle pendiente">⚠️ Sin pagar</span>
                    ` : ''}
                </div>
            </td>
            <td>${getEstadoBadgeMejorado(venta.estadoPago)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon btn-view" onclick="verDetalles('${venta.id}')" title="Ver detalles">👁️</button>
                    <button class="btn-icon btn-edit" onclick="editarVenta('${venta.id}')" title="Editar">✏️</button>
                    <button class="btn-icon btn-delete" onclick="eliminarVenta('${venta.id}', '${escapeHtml(venta.clienteNombre)}')" title="Eliminar">🗑️</button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
    
    actualizarResumenFiltros(ventas);
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function getEstadoBadgeMejorado(estado) {
    const badges = {
        'Pagado': '<span class="badge badge-success">✅ Pagado Completo</span>',
        'Pendiente': '<span class="badge badge-danger">⏳ Sin Pagar</span>',
        'Parcial': '<span class="badge badge-info">📊 Pago Parcial</span>'
    };
    return badges[estado] || '<span class="badge">Sin estado</span>';
}

window.verDetalles = function(id) {
    const venta = ventasGlobal.find(v => v.id === id);
    if (!venta) return;
    
    ventaActual = venta;
    
    const tieneSaldoPendiente = venta.estadoPago === 'Parcial' || venta.estadoPago === 'Pendiente';
    const montoPagado = parseFloat(venta.montoPagado || 0);
    const saldoPendiente = parseFloat(venta.saldoPendiente || 0);
    
    const html = `
        <div class="detail-section">
            <h4>📅 Fecha de la Venta</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Fecha registrada</span>
                    <span class="detail-value" style="font-weight: 700; color: var(--color-primary);">
                        ${new Date(venta.fecha.toDate ? venta.fecha.toDate() : venta.fecha).toLocaleDateString('es-GT', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        })}
                    </span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h4>📋 Información del Cliente</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Cliente</span>
                    <span class="detail-value">${venta.clienteNombre || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Teléfono</span>
                    <span class="detail-value">${venta.clienteTelefono || 'No registrado'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Email</span>
                    <span class="detail-value">${venta.clienteEmail || 'No registrado'}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h4>🍄 Información del Producto</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Tipo de Hongo</span>
                    <span class="detail-value">${venta.tipoHongo || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Cantidad</span>
                    <span class="detail-value">${venta.cantidad || 0} ${venta.unidadMedida || ''}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Precio Unitario</span>
                    <span class="detail-value">Q${parseFloat(venta.precioUnitario || 0).toFixed(2)}</span>
                </div>
            </div>
        </div>

        <div class="detail-section" style="background: ${tieneSaldoPendiente ? '#fff7ed' : '#f0fdf4'}; border-left-color: ${tieneSaldoPendiente ? '#f59e0b' : '#10b981'};">
            <h4>💰 Información de Pago</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Método de Pago</span>
                    <span class="detail-value">${venta.metodoPago || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Estado</span>
                    <span class="detail-value">${getEstadoBadgeMejorado(venta.estadoPago)}</span>
                </div>
                ${venta.numeroFactura ? `<div class="detail-item"><span class="detail-label">Nº Factura</span><span class="detail-value">${venta.numeroFactura}</span></div>` : ''}
            </div>
            
            ${tieneSaldoPendiente ? `
            <div style="margin-top: 1.5rem; padding: 1rem; background: white; border-radius: 8px; border: 2px solid #fbbf24;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div>
                        <span style="display: block; font-size: 0.85rem; color: var(--color-text-light); margin-bottom: 0.25rem;">✅ Monto Pagado</span>
                        <span style="font-size: 1.3rem; font-weight: 700; color: var(--color-success);">Q${montoPagado.toFixed(2)}</span>
                    </div>
                    <div>
                        <span style="display: block; font-size: 0.85rem; color: var(--color-text-light); margin-bottom: 0.25rem;">⏳ Saldo Pendiente</span>
                        <span style="font-size: 1.3rem; font-weight: 700; color: var(--color-warning);">Q${saldoPendiente.toFixed(2)}</span>
                    </div>
                </div>
                <button class="btn" onclick="abrirModalRegistrarPago('${venta.id}')" style="width:100%; margin-top:1rem; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white;">💰 Registrar Pago</button>
            </div>` : ''}
        </div>

        ${venta.notas ? `<div class="detail-section"><h4>📝 Notas</h4><p style="margin: 0; color: var(--color-text);">${venta.notas}</p></div>` : ''}

        ${venta.historialPagos && venta.historialPagos.length > 0 ? `
        <div class="detail-section">
            <h4>📜 Historial de Pagos</h4>
            <div style="max-height: 200px; overflow-y: auto;">
                ${venta.historialPagos.map(pago => `
                    <div style="padding: 0.75rem; background: #f9fafb; border-radius: 6px; margin-bottom: 0.5rem; border-left: 3px solid var(--color-success);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="color: var(--color-success);">Q${parseFloat(pago.monto).toFixed(2)}</strong>
                                <span style="font-size: 0.85rem; color: var(--color-text-light); margin-left: 0.5rem;">${pago.metodo}</span>
                            </div>
                            <span style="font-size: 0.85rem; color: var(--color-text-light);">${new Date(pago.fecha).toLocaleDateString('es-GT')}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}

        <div class="detail-highlight">
            <div class="detail-highlight-label">TOTAL DE LA VENTA</div>
            <div class="detail-highlight-value">Q${parseFloat(venta.total || 0).toFixed(2)}</div>
            <div style="margin-top: 1rem; font-size: 0.9rem; color: var(--color-text-light);">
                Subtotal: Q${parseFloat(venta.subtotal || 0).toFixed(2)} | Descuento: -Q${parseFloat(venta.descuentoAplicado || 0).toFixed(2)}
            </div>
        </div>
    `;
    
    document.getElementById('detallesContent').innerHTML = html;
    document.getElementById('modalDetalles').classList.add('active');
};

window.generarReciboPDFGlobal = function() {
    if (ventaActual) {
        generarReciboPDF(ventaActual);
    }
};

window.editarVentaGlobal = function() {
    cerrarModal('modalDetalles');
    abrirModalEditar(ventaActual);
};

window.editarVenta = function(id) {
    const venta = ventasGlobal.find(v => v.id === id);
    if (!venta) return;
    abrirModalEditar(venta);
};

function abrirModalEditar(venta) {
    ventaActual = venta;
    
    // Convertir fecha a YYYY-MM-DD
    let fechaVenta;
    if (venta.fecha && venta.fecha.toDate) {
        fechaVenta = venta.fecha.toDate();
    } else if (venta.fecha) {
        fechaVenta = new Date(venta.fecha);
    } else {
        fechaVenta = new Date();
    }
    const fechaFormato = fechaVenta.toISOString().split('T')[0];
    
    document.getElementById('editVentaId').value = venta.id;
    document.getElementById('editClienteId').value = venta.clienteId || '';
    document.getElementById('clienteOriginal').textContent = venta.clienteNombre || 'N/A';
    document.getElementById('editFechaVenta').value = fechaFormato;
    document.getElementById('editTipoHongo').value = venta.tipoHongo || 'Ostra Fresco';
    document.getElementById('editCantidad').value = venta.cantidad || 0;
    document.getElementById('editUnidadMedida').value = venta.unidadMedida || 'libras';
    document.getElementById('editPrecioUnitario').value = venta.precioUnitario || 0;
    document.getElementById('editMetodoPago').value = venta.metodoPago || 'Efectivo';
    document.getElementById('editEstadoPago').value = venta.estadoPago || 'Pagado';
    document.getElementById('editDescuento').value = venta.descuentoAplicado || 0;
    document.getElementById('editNotas').value = venta.notas || '';
    
    calcularTotalesEdicion();
    document.getElementById('modalEditar').classList.add('active');
}

function calcularTotalesEdicion() {
    const cantidad = parseFloat(document.getElementById('editCantidad').value) || 0;
    const precioUnitario = parseFloat(document.getElementById('editPrecioUnitario').value) || 0;
    const descuento = parseFloat(document.getElementById('editDescuento').value) || 0;
    
    const subtotal = cantidad * precioUnitario;
    const total = subtotal - descuento;
    
    document.getElementById('editSubtotalDisplay').textContent = `Q${subtotal.toFixed(2)}`;
    document.getElementById('editDescuentoDisplay').textContent = `-Q${descuento.toFixed(2)}`;
    document.getElementById('editTotalDisplay').textContent = `Q${total.toFixed(2)}`;
}

async function guardarEdicion() {
    const ventaId = document.getElementById('editVentaId').value;
    const fechaVentaInput = document.getElementById('editFechaVenta').value;
    
    if (!fechaVentaInput) {
        mostrarToast('Por favor selecciona una fecha válida', 'error');
        return;
    }
    
    // Validar contraseña ANTES de procesar nada
    if (!verificarPermisoAdmin()) return;

    const fechaSeleccionada = new Date(fechaVentaInput + 'T12:00:00');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    if (fechaSeleccionada > hoy) {
        mostrarToast('La fecha de venta no puede ser futura', 'error');
        return;
    }
    
    const cantidad = parseFloat(document.getElementById('editCantidad').value) || 0;
    const precioUnitario = parseFloat(document.getElementById('editPrecioUnitario').value) || 0;
    const descuento = parseFloat(document.getElementById('editDescuento').value) || 0;
    const subtotal = cantidad * precioUnitario;
    const total = subtotal - descuento;
    
    const clienteId = document.getElementById('editClienteId').value;
    const cliente = clientesGlobal.find(c => c.id === clienteId);
    
    try {
        await updateDoc(doc(db, 'ventas', ventaId), {
            clienteId, 
            clienteNombre: cliente?.nombre || ventaActual.clienteNombre,
            fecha: fechaSeleccionada, 
            tipoHongo: document.getElementById('editTipoHongo').value,
            cantidad, 
            unidadMedida: document.getElementById('editUnidadMedida').value,
            precioUnitario, 
            metodoPago: document.getElementById('editMetodoPago').value,
            estadoPago: document.getElementById('editEstadoPago').value,
            descuentoAplicado: descuento, 
            subtotal, 
            total,
            notas: document.getElementById('editNotas').value, 
            fechaModificacion: new Date()
        });
        
        mostrarToast('¡Venta actualizada exitosamente!', 'success', true);
        cerrarModal('modalEditar');
        await cargarDatos();
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al actualizar: ' + error.message, 'error');
    }
}

window.abrirModalRegistrarPago = function(ventaId) {
    const venta = ventasGlobal.find(v => v.id === ventaId);
    if (!venta) return;
    
    ventaActual = venta;
    const saldoPendiente = parseFloat(venta.saldoPendiente || venta.total || 0);
    
    document.getElementById('pagoVentaId').value = venta.id;
    document.getElementById('pagoClienteNombre').textContent = venta.clienteNombre || 'N/A';
    document.getElementById('pagoTotalVenta').textContent = `Q${parseFloat(venta.total || 0).toFixed(2)}`;
    document.getElementById('pagoMontoPagado').textContent = `Q${parseFloat(venta.montoPagado || 0).toFixed(2)}`;
    document.getElementById('pagoSaldoPendiente').textContent = `Q${saldoPendiente.toFixed(2)}`;
    document.getElementById('pagoMontoNuevo').value = saldoPendiente.toFixed(2);
    document.getElementById('pagoMontoNuevo').max = saldoPendiente.toFixed(2);
    document.getElementById('pagoMetodo').value = venta.metodoPago || 'Efectivo';
    document.getElementById('pagoFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('pagoNotas').value = '';
    
    cerrarModal('modalDetalles');
    document.getElementById('modalRegistrarPago').classList.add('active');
};

async function registrarPago() {
    const ventaId = document.getElementById('pagoVentaId').value;
    const montoNuevo = parseFloat(document.getElementById('pagoMontoNuevo').value) || 0;
    const venta = ventasGlobal.find(v => v.id === ventaId);
    
    if (!venta || montoNuevo <= 0) {
        mostrarToast('Monto inválido', 'error');
        return;
    }
    
    // Validar contraseña
    if (!verificarPermisoAdmin()) return;
    
    const saldoPendiente = parseFloat(venta.saldoPendiente || venta.total || 0);
    if (montoNuevo > saldoPendiente) {
        mostrarToast(`El monto no puede ser mayor al saldo pendiente (Q${saldoPendiente.toFixed(2)})`, 'error');
        return;
    }
    
    try {
        const montoPagadoAnterior = parseFloat(venta.montoPagado || 0);
        const nuevoMontoPagado = montoPagadoAnterior + montoNuevo;
        const nuevoSaldoPendiente = parseFloat(venta.total) - nuevoMontoPagado;
        const nuevoEstado = nuevoSaldoPendiente <= 0.01 ? 'Pagado' : 'Parcial';
        
        const historialPagos = venta.historialPagos || [];
        historialPagos.push({
            monto: montoNuevo,
            metodo: document.getElementById('pagoMetodo').value,
            fecha: document.getElementById('pagoFecha').value,
            notas: document.getElementById('pagoNotas').value,
            fechaRegistro: new Date().toISOString()
        });
        
        await updateDoc(doc(db, 'ventas', ventaId), {
            montoPagado: nuevoMontoPagado,
            saldoPendiente: Math.max(0, nuevoSaldoPendiente),
            estadoPago: nuevoEstado,
            metodoPago: document.getElementById('pagoMetodo').value,
            historialPagos,
            fechaUltimoPago: new Date(),
            fechaModificacion: new Date()
        });
        
        mostrarToast(nuevoEstado === 'Pagado' ? '✅ ¡Pago completado!' : `✅ Pago registrado. Saldo: Q${nuevoSaldoPendiente.toFixed(2)}`, 'success', true);
        cerrarModal('modalRegistrarPago');
        await cargarDatos();
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al registrar pago: ' + error.message, 'error');
    }
}

window.eliminarVenta = async function(id, clienteNombre) {
    const nombreDecodificado = clienteNombre.replace(/&quot;/g, '"').replace(/&#039;/g, "'");
    
    const confirmar = confirm(`¿Estás seguro de eliminar la venta de "${nombreDecodificado}"?\n\nEsta acción no se puede deshacer.`);
    if (!confirmar) return;
    
    // Validar contraseña para eliminar
    if (!verificarPermisoAdmin()) return;
    
    try {
        await deleteDoc(doc(db, 'ventas', id));
        mostrarToast('Venta eliminada correctamente', 'success', true);
        await cargarDatos();
    } catch (error) {
        mostrarToast('Error al eliminar: ' + error.message, 'error');
    }
};

function aplicarFiltros() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const fechaDesde = document.getElementById('fechaDesde').value;
    const fechaHasta = document.getElementById('fechaHasta').value;
    const estadoFiltro = document.getElementById('estadoFiltro').value;
    const hongoFiltro = document.getElementById('hongoFiltro').value;
    const metodoPagoFiltro = document.getElementById('metodoPagoFiltro').value;
    
    // Lógica para filtros de fecha (ignorando hora UTC para evitar errores de dia anterior)
    let fechaInicio = null;
    let fechaFin = null;
    if (fechaDesde) {
        const [y, m, d] = fechaDesde.split('-').map(Number);
        fechaInicio = new Date(y, m - 1, d, 0, 0, 0, 0);
    }
    if (fechaHasta) {
        const [y, m, d] = fechaHasta.split('-').map(Number);
        fechaFin = new Date(y, m - 1, d, 23, 59, 59, 999);
    }

    let ventasFiltradas = ventasGlobal.filter(v => {
        // Búsqueda por texto
        if (searchTerm) {
            const coincide = 
                v.clienteNombre?.toLowerCase().includes(searchTerm) ||
                v.tipoHongo?.toLowerCase().includes(searchTerm) ||
                v.metodoPago?.toLowerCase().includes(searchTerm) ||
                v.notas?.toLowerCase().includes(searchTerm);
            if (!coincide) return false;
        }
        
        const fechaVenta = v.fecha.toDate ? v.fecha.toDate() : new Date(v.fecha);

        // Filtro por fecha desde
        if (fechaInicio && fechaVenta < fechaInicio) return false;
        
        // Filtro por fecha hasta
        if (fechaFin && fechaVenta > fechaFin) return false;
        
        // Filtro por estado
        if (estadoFiltro && v.estadoPago !== estadoFiltro) return false;
        
        // Filtro por tipo de hongo
        if (hongoFiltro && v.tipoHongo !== hongoFiltro) return false;
        
        // Filtro por método de pago
        if (metodoPagoFiltro && v.metodoPago !== metodoPagoFiltro) return false;
        
        return true;
    });
    
    cargarTablaVentas(ventasFiltradas);
    document.getElementById('totalVentas').textContent = ventasFiltradas.length;
}

function aplicarFiltroRapido(filtro, event) {
    limpiarFiltros();
    
    document.querySelectorAll('.btn-quick-filter').forEach(btn => btn.classList.remove('active'));
    
    const hoy = new Date();
    let desde = new Date(hoy);
    let hasta = new Date(hoy);
    
    switch(filtro) {
        case 'hoy':
            // hoy a hoy
            break;
        case 'semana':
            desde.setDate(hoy.getDate() - hoy.getDay());
            break;
        case 'mes':
            desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            break;
    }
    
    const format = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    
    document.getElementById('fechaDesde').value = format(desde);
    document.getElementById('fechaHasta').value = format(hasta);
    
    if (event && event.target) event.target.classList.add('active');
    
    aplicarFiltros();
}

function actualizarResumenFiltros(ventas) {
    const totalFiltrado = document.getElementById('totalFiltrado');
    const montoFiltrado = document.getElementById('montoFiltrado');
    
    totalFiltrado.textContent = ventas.length;
    
    if (ventas.length > 0) {
        const montoTotal = ventas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
        montoFiltrado.style.display = 'inline-block';
        montoFiltrado.querySelector('strong').textContent = `Q${montoTotal.toFixed(2)}`;
    } else {
        montoFiltrado.style.display = 'none';
    }
}

function limpiarFiltros() {
    ['searchInput', 'fechaDesde', 'fechaHasta', 'estadoFiltro', 'hongoFiltro', 'metodoPagoFiltro'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.querySelectorAll('.btn-quick-filter').forEach(btn => btn.classList.remove('active'));
    
    cargarTablaVentas(ventasGlobal);
    document.getElementById('totalVentas').textContent = ventasGlobal.length;
}

function exportarVentas() {
    if (ventasGlobal.length === 0) {
        mostrarToast('No hay ventas para exportar', 'warning');
        return;
    }
    
    const headers = ['Fecha', 'Cliente', 'Hongo', 'Cantidad', 'Unidad', 'Precio Unit.', 'Método Pago', 'Estado', 'Subtotal', 'Descuento', 'Total'];
    let csvContent = headers.join(',') + '\n';
    
    ventasGlobal.forEach(v => {
        csvContent += [formatearFecha(v.fecha), v.clienteNombre||'', v.tipoHongo||'', v.cantidad||0, v.unidadMedida||'', v.precioUnitario||0, v.metodoPago||'', v.estadoPago||'', v.subtotal||0, v.descuentoAplicado||0, v.total||0].join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ventas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    mostrarToast('¡Ventas exportadas!', 'success');
}

window.cerrarModal = function(modalId) {
    document.getElementById(modalId).classList.remove('active');
};

async function generarReciboPDF(venta) {
    if (typeof window.jspdf === 'undefined') {
        alert('Error: jsPDF no está cargada');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const colorPrimario = [74, 124, 44];
    const colorTexto = [31, 41, 55];
    const colorGris = [107, 114, 128];
    
    try {
        const imgData = await cargarImagenComoBase64(CONFIG_NEGOCIO.logoPath);
        let y = 20;
        
        doc.setFillColor(...colorPrimario);
        doc.rect(0, 0, 210, 60, 'F');
        
        if (imgData) doc.addImage(imgData, 'PNG', 15, 15, 30, 30);
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont(undefined, 'bold');
        doc.text(CONFIG_NEGOCIO.nombre, 50, 28);
        
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(CONFIG_NEGOCIO.slogan, 50, 36);
        doc.text(CONFIG_NEGOCIO.direccion, 155, 25);
        doc.text(`Tel: ${CONFIG_NEGOCIO.telefono}`, 155, 32);
        
        doc.setTextColor(...colorPrimario);
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text('RECIBO DE VENTA', 105, 52, { align: 'center' });
        
        y = 70;
        doc.setTextColor(...colorTexto);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(`Recibo No: ${venta.numeroFactura || `REC-${(venta.id||'TEMP').substring(0,8).toUpperCase()}`}`, 20, y);
        doc.setFont(undefined, 'normal');
        doc.text(`Fecha: ${formatearFecha(venta.fecha)}`, 150, y);
        
        y += 15;
        doc.setFillColor(240, 240, 240);
        doc.rect(15, y, 180, 25, 'F');
        y += 7;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text('DATOS DEL CLIENTE', 20, y);
        y += 7;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Cliente: ${venta.clienteNombre||'Cliente General'}`, 20, y);
        if (venta.clienteTelefono) doc.text(`Telefono: ${venta.clienteTelefono}`, 120, y);
        y += 6;
        if (venta.clienteEmail) doc.text(`Email: ${venta.clienteEmail}`, 20, y);
        
        y += 15;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text('DETALLE DE LA VENTA', 20, y);
        y += 8;
        
        doc.setFillColor(...colorPrimario);
        doc.rect(15, y-5, 180, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text('PRODUCTO', 20, y);
        doc.text('CANTIDAD', 80, y);
        doc.text('PRECIO UNIT.', 115, y);
        doc.text('SUBTOTAL', 165, y);
        y += 8;
        
        doc.setTextColor(...colorTexto);
        doc.setFont(undefined, 'normal');
        doc.text(venta.tipoHongo||'Hongo', 20, y);
        doc.text(`${venta.cantidad||0} ${venta.unidadMedida||''}`, 80, y);
        doc.text(`Q${parseFloat(venta.precioUnitario||0).toFixed(2)}`, 115, y);
        doc.text(`Q${parseFloat(venta.subtotal||0).toFixed(2)}`, 165, y);
        y += 10;
        
        doc.setDrawColor(...colorGris);
        doc.line(15, y, 195, y);
        y += 10;
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text('Subtotal:', 130, y);
        doc.text(`Q${parseFloat(venta.subtotal||0).toFixed(2)}`, 165, y);
        y += 7;
        
        if (venta.descuentoAplicado && parseFloat(venta.descuentoAplicado) > 0) {
            doc.setTextColor(...colorPrimario);
            doc.text('Descuento:', 130, y);
            doc.text(`-Q${parseFloat(venta.descuentoAplicado).toFixed(2)}`, 165, y);
            doc.setTextColor(...colorTexto);
            y += 7;
        }
        
        doc.setDrawColor(...colorPrimario);
        doc.setLineWidth(0.5);
        doc.line(125, y, 195, y);
        y += 8;
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...colorPrimario);
        doc.text('TOTAL:', 130, y);
        doc.text(`Q${parseFloat(venta.total||0).toFixed(2)}`, 165, y);
        y += 15;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...colorTexto);
        doc.text('INFORMACION DE PAGO', 20, y);
        y += 7;
        doc.setFont(undefined, 'normal');
        doc.text(`Metodo de Pago: ${venta.metodoPago||'N/A'}`, 20, y);
        doc.text(`Estado: ${venta.estadoPago==='Pagado'?'PAGADO':venta.estadoPago==='Pendiente'?'PENDIENTE':'PARCIAL'}`, 120, y);
        
        if (venta.notas) {
            y += 15;
            doc.setFont(undefined, 'bold');
            doc.text('NOTAS:', 20, y);
            y += 6;
            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);
            doc.text(doc.splitTextToSize(venta.notas, 170), 20, y);
        }
        
        const footerY = 270;
        doc.setDrawColor(...colorPrimario);
        doc.setLineWidth(1);
        doc.line(15, footerY, 195, footerY);
        doc.setFontSize(8);
        doc.setTextColor(...colorGris);
        doc.setFont(undefined, 'italic');
        doc.text('Gracias por su compra', 105, footerY+5, { align: 'center' });
        
        
        const nombreArchivo = `Recibo_${venta.numeroFactura||'REC'}_${(venta.clienteNombre||'Cliente').replace(/\s+/g,'_')}.pdf`;
        doc.save(nombreArchivo);
        
        mostrarToast('✅ Recibo generado', 'success');
    } catch (error) {
        console.error('Error:', error);
        alert('Error al generar recibo: ' + error.message);
    }
}

async function cargarImagenComoBase64(rutaImagen) {
    try {
        const response = await fetch(rutaImagen);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Error al cargar imagen:', error);
        return null;
    }

}
