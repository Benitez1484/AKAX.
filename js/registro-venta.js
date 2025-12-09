// js/registro-venta.js - CON DETECTOR DE DUPLICADOS EN TIEMPO REAL
import { db, collection, addDoc, Timestamp, query, orderBy, limit, getDocs, where } from './firebase-config.js';
import { cargarClientes, mostrarToast, verificarConexion, reintentarConexion } from './common.js';

let clientesGlobal = [];
let datosVentaTemporal = null;

// ==================== INICIALIZACIÓN ====================

window.reintentarConexionManual = async function() {
    await reintentarConexion();
    await inicializarPagina();
};

document.addEventListener('DOMContentLoaded', async () => {
    configurarMenu(); 
    const conectado = await verificarConexion();
    if (conectado) {
        await inicializarPagina();
    } else {
        mostrarToast('⚠️ Sin conexión a Firebase', 'warning', true);
    }
    configurarEventos();
});

async function inicializarPagina() {
    try {
        clientesGlobal = await cargarClientes();
        cargarSelectClientes();
        
        const fechaInput = document.getElementById('fechaVenta');
        if (!fechaInput.value) {
            fechaInput.value = new Date().toISOString().split('T')[0];
        }

        // Calcular siguiente recibo
        await sugerirSiguienteRecibo();

        calcularTotales();
    } catch (error) {
        console.error('Error al inicializar:', error);
        mostrarToast('Error al cargar datos iniciales', 'error', true);
    }
}

// ==================== LÓGICA DE RECIBOS INTELIGENTE ====================

async function sugerirSiguienteRecibo() {
    const inputFactura = document.getElementById('numeroFactura');
    inputFactura.placeholder = "Calculando...";
    
    try {
        const q = query(collection(db, "ventas"), orderBy("fechaRegistro", "desc"), limit(1));
        const querySnapshot = await getDocs(q);
        
        let ultimoNumero = 0;
        let prefijo = "";

        if (!querySnapshot.empty) {
            const ultimaVenta = querySnapshot.docs[0].data();
            const ultimoRecibo = ultimaVenta.numeroFactura || "";
            const match = ultimoRecibo.match(/(\d+)$/);
            
            if (match) {
                ultimoNumero = parseInt(match[0], 10);
                prefijo = ultimoRecibo.substring(0, match.index);
            } else if (!isNaN(ultimoRecibo) && ultimoRecibo !== "") {
                ultimoNumero = parseInt(ultimoRecibo, 10);
            }
        }

        const siguiente = ultimoNumero + 1;
        inputFactura.value = `${prefijo}${siguiente}`;
        
        // Validar inmediatamente por si acaso ya existe (casos raros)
        verificarDuplicadoRecibo(); 
        
    } catch (error) {
        console.error("Error al calcular recibo:", error);
        inputFactura.placeholder = "Ej: 1001";
    }
}

// 🛑 FUNCIÓN DE SEGURIDAD: VERIFICAR DUPLICADOS
async function verificarDuplicadoRecibo() {
    const input = document.getElementById('numeroFactura');
    const valor = input.value.trim();
    const btnRegistrar = document.getElementById('btnRegistrarVenta');
    const btnPrevia = document.getElementById('btnVistaPrevia');
    
    // Crear o buscar el elemento de mensaje de error
    let errorMsg = document.getElementById('errorRecibo');
    if (!errorMsg) {
        errorMsg = document.createElement('div');
        errorMsg.id = 'errorRecibo';
        errorMsg.style.fontSize = '0.85rem';
        errorMsg.style.marginTop = '5px';
        input.parentNode.appendChild(errorMsg);
    }

    if (!valor) {
        errorMsg.textContent = "";
        input.style.borderColor = "";
        btnRegistrar.disabled = false;
        btnPrevia.disabled = false;
        return;
    }

    try {
        // Consultar si existe ESE número exacto
        const q = query(collection(db, "ventas"), where("numeroFactura", "==", valor));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            // 🚨 EXISTE: BLOQUEAR TODO
            errorMsg.innerHTML = `⛔ <strong>El recibo "${valor}" ya existe.</strong> Cambialo.`;
            errorMsg.style.color = "var(--color-danger)";
            input.style.borderColor = "var(--color-danger)";
            input.style.background = "#fff5f5";
            
            btnRegistrar.disabled = true;
            btnRegistrar.style.opacity = "0.5";
            btnRegistrar.style.cursor = "not-allowed";
            
            btnPrevia.disabled = true; // También bloqueamos la vista previa por seguridad
        } else {
            // ✅ NO EXISTE: LIBERAR
            errorMsg.innerHTML = `✅ Disponible`;
            errorMsg.style.color = "var(--color-success)";
            input.style.borderColor = "var(--color-success)";
            input.style.background = "#ffffff";
            
            btnRegistrar.disabled = false;
            btnRegistrar.style.opacity = "1";
            btnRegistrar.style.cursor = "pointer";
            btnPrevia.disabled = false;
        }
    } catch (error) {
        console.error("Error verificando duplicado:", error);
    }
}

// ==================== CONFIGURACIÓN DE EVENTOS ====================
function configurarEventos() {
    document.getElementById('btnVistaPrevia')?.addEventListener('click', mostrarVistaPrevia);
    document.getElementById('btnRegistrarVenta')?.addEventListener('click', registrarVentaDirecta);
    
    document.getElementById('btnCerrarPrevia')?.addEventListener('click', cerrarVistaPrevia);
    document.getElementById('btnCancelarPrevia')?.addEventListener('click', cerrarVistaPrevia);
    document.getElementById('btnConfirmarVenta')?.addEventListener('click', confirmarYGuardarVenta);
    
    document.getElementById('btnNuevoCliente')?.addEventListener('click', abrirModalCliente);
    document.getElementById('btnCerrarModalCliente')?.addEventListener('click', cerrarModalCliente);
    document.getElementById('btnCancelarCliente')?.addEventListener('click', cerrarModalCliente);
    document.getElementById('btnGuardarCliente')?.addEventListener('click', guardarNuevoCliente);

    ['cantidad', 'precioUnitario', 'descuento'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', calcularTotales);
    });

    document.getElementById('clienteId')?.addEventListener('change', mostrarInfoCliente);
    document.getElementById('tipoHongo')?.addEventListener('change', toggleOtroHongo);
    document.getElementById('tipoDescuento')?.addEventListener('change', calcularTotales);
    document.getElementById('estadoPago')?.addEventListener('change', toggleMontoPagado);
    document.getElementById('montoPagado')?.addEventListener('input', calcularSaldoPendiente);
    
    // ✅ ESCUCHAR CAMBIOS EN EL RECIBO PARA VALIDAR
    const inputFactura = document.getElementById('numeroFactura');
    // Usamos 'input' con un pequeño retraso (debounce) para no saturar Firebase mientras escribes
    let timeout = null;
    inputFactura?.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(verificarDuplicadoRecibo, 500); // Espera 0.5s después de dejar de escribir
    });
}

// ==================== LÓGICA DE NEGOCIO ====================

function cargarSelectClientes() {
    const select = document.getElementById('clienteId');
    const seleccionActual = select.value;
    select.innerHTML = '<option value="">Seleccionar cliente</option>';
    clientesGlobal.forEach(cliente => {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = cliente.nombre;
        select.appendChild(option);
    });
    if (seleccionActual) select.value = seleccionActual;
}

function mostrarInfoCliente() {
    const clienteId = document.getElementById('clienteId').value;
    const infoBox = document.getElementById('infoCliente');
    if (!clienteId) {
        infoBox.style.display = 'none';
        return;
    }
    const cliente = clientesGlobal.find(c => c.id === clienteId);
    if (cliente) {
        document.getElementById('infoTelefono').textContent = cliente.telefono || '-';
        document.getElementById('infoEmail').textContent = cliente.email || '-';
        document.getElementById('infoDireccion').textContent = cliente.direccion || '-';
        infoBox.style.display = 'block';
    }
}

function calcularTotales() {
    const cantidad = parseFloat(document.getElementById('cantidad').value) || 0;
    const precioUnitario = parseFloat(document.getElementById('precioUnitario').value) || 0;
    const descuentoInput = parseFloat(document.getElementById('descuento').value) || 0;
    const tipoDescuento = document.getElementById('tipoDescuento').value;
    
    const subtotal = cantidad * precioUnitario;
    let descuentoAplicado = descuentoInput;
    
    if (tipoDescuento === 'Porcentaje') {
        descuentoAplicado = (subtotal * descuentoInput) / 100;
    }
    
    const total = Math.max(0, subtotal - descuentoAplicado);
    
    document.getElementById('subtotalDisplay').textContent = `Q${subtotal.toFixed(2)}`;
    document.getElementById('descuentoDisplay').textContent = `-Q${descuentoAplicado.toFixed(2)}`;
    document.getElementById('totalPagar').textContent = `Q${total.toFixed(2)}`;
    
    if (document.getElementById('estadoPago').value === 'Parcial') {
        calcularSaldoPendiente();
    }
}

function toggleOtroHongo() {
    const esOtro = document.getElementById('tipoHongo').value === 'Otro';
    document.getElementById('otroHongoGroup').style.display = esOtro ? 'block' : 'none';
}

function toggleMontoPagado() {
    const estado = document.getElementById('estadoPago').value;
    const container = document.getElementById('montoPagadoGroup');
    
    if (estado === 'Parcial') {
        container.style.display = 'grid';
        calcularSaldoPendiente();
    } else {
        container.style.display = 'none';
    }
}

function calcularSaldoPendiente() {
    const totalText = document.getElementById('totalPagar').textContent;
    const total = parseFloat(totalText.replace('Q', '')) || 0;
    const pagado = parseFloat(document.getElementById('montoPagado').value) || 0;
    
    document.getElementById('saldoPendiente').value = Math.max(0, total - pagado).toFixed(2);
}

function obtenerDatosFormulario() {
    const clienteId = document.getElementById('clienteId').value;
    const cliente = clientesGlobal.find(c => c.id === clienteId);
    
    let tipoHongo = document.getElementById('tipoHongo').value;
    if (tipoHongo === 'Otro') {
        tipoHongo = document.getElementById('otroHongo').value.trim() || 'Otro';
    }

    const cantidad = parseFloat(document.getElementById('cantidad').value) || 0;
    const precio = parseFloat(document.getElementById('precioUnitario').value) || 0;
    const subtotal = cantidad * precio;
    
    const descVal = parseFloat(document.getElementById('descuento').value) || 0;
    const tipoDesc = document.getElementById('tipoDescuento').value;
    const descuentoAplicado = tipoDesc === 'Porcentaje' ? (subtotal * descVal / 100) : descVal;
    const total = Math.max(0, subtotal - descuentoAplicado);

    const estadoPago = document.getElementById('estadoPago').value;
    let montoPagado = 0;
    let saldoPendiente = 0;

    if (estadoPago === 'Pagado') {
        montoPagado = total;
    } else if (estadoPago === 'Pendiente') {
        saldoPendiente = total;
    } else if (estadoPago === 'Parcial') {
        montoPagado = parseFloat(document.getElementById('montoPagado').value) || 0;
        saldoPendiente = Math.max(0, total - montoPagado);
    }

    const fechaInput = document.getElementById('fechaVenta').value;
    const fechaVenta = fechaInput ? new Date(`${fechaInput}T12:00:00`) : new Date();

    return {
        clienteId,
        clienteNombre: cliente?.nombre || 'Cliente General',
        clienteTelefono: cliente?.telefono || '',
        clienteEmail: cliente?.email || '',
        fecha: Timestamp.fromDate(fechaVenta),
        tipoHongo,
        cantidad,
        unidadMedida: document.getElementById('unidadMedida').value,
        precioUnitario: precio,
        subtotal,
        descuentoAplicado,
        total,
        metodoPago: document.getElementById('metodoPago').value,
        estadoPago,
        montoPagado,
        saldoPendiente,
        numeroFactura: document.getElementById('numeroFactura').value.trim(),
        notas: document.getElementById('notas').value.trim(),
        fechaRegistro: Timestamp.now()
    };
}

function validarDatos(datos) {
    if (!datos.clienteId) return 'Selecciona un cliente';
    if (datos.cantidad <= 0) return 'La cantidad debe ser mayor a 0';
    if (datos.precioUnitario < 0) return 'El precio no puede ser negativo';
    
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    if (datos.fecha.toDate() > hoy) return 'La fecha de venta no puede ser futura';

    return null;
}

function mostrarVistaPrevia(e) {
    e.preventDefault();
    const datos = obtenerDatosFormulario();
    const error = validarDatos(datos);
    
    if (error) {
        mostrarToast(error, 'error', true);
        return;
    }

    datosVentaTemporal = datos;
    const fechaStr = datos.fecha.toDate().toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const html = `
        <div class="preview-section">
            <h3>📅 ${fechaStr}</h3>
            <div class="preview-grid">
                <div class="preview-item"><span class="preview-label">Cliente</span><span class="preview-value">${datos.clienteNombre}</span></div>
                <div class="preview-item"><span class="preview-label">Producto</span><span class="preview-value">${datos.tipoHongo}</span></div>
                <div class="preview-item"><span class="preview-label">Cantidad</span><span class="preview-value">${datos.cantidad} ${datos.unidadMedida}</span></div>
                <div class="preview-item"><span class="preview-label">Estado</span><span class="preview-value"><span class="preview-badge badge-${datos.estadoPago === 'Pagado' ? 'success' : datos.estadoPago === 'Pendiente' ? 'danger' : 'warning'}">${datos.estadoPago}</span></span></div>
                ${datos.numeroFactura ? `<div class="preview-item"><span class="preview-label">Recibo</span><span class="preview-value" style="font-weight:bold;">${datos.numeroFactura}</span></div>` : ''}
            </div>
        </div>
        <div class="preview-total-box">
            <h3>TOTAL A COBRAR</h3>
            <div class="preview-total-amount">Q${datos.total.toFixed(2)}</div>
            ${datos.estadoPago === 'Parcial' ? `<p style="margin-top:0.5rem; opacity:0.9">Pagado: Q${datos.montoPagado.toFixed(2)} | Pendiente: Q${datos.saldoPendiente.toFixed(2)}</p>` : ''}
        </div>
    `;

    document.getElementById('previaContent').innerHTML = html;
    document.getElementById('modalVistaPrevia').classList.add('active');
}

function cerrarVistaPrevia() {
    document.getElementById('modalVistaPrevia').classList.remove('active');
}

async function confirmarYGuardarVenta() {
    if (!datosVentaTemporal) return;
    await guardarVentaEnFirebase(datosVentaTemporal, document.getElementById('btnConfirmarVenta'));
    cerrarVistaPrevia();
}

async function registrarVentaDirecta(e) {
    e.preventDefault();
    const datos = obtenerDatosFormulario();
    const error = validarDatos(datos);
    
    if (error) {
        mostrarToast(error, 'error', true);
        return;
    }

    await guardarVentaEnFirebase(datos, document.getElementById('btnRegistrarVenta'));
}

async function guardarVentaEnFirebase(datos, btnElement) {
    // Doble validación por seguridad
    const q = query(collection(db, "ventas"), where("numeroFactura", "==", datos.numeroFactura));
    const snap = await getDocs(q);
    if (!snap.empty && datos.numeroFactura !== "") {
        mostrarToast(`⛔ El recibo ${datos.numeroFactura} ya existe. Cambialo.`, 'error', true);
        return;
    }

    const textoOriginal = btnElement.innerHTML;
    btnElement.classList.add('btn-loading');
    btnElement.disabled = true;
    btnElement.innerHTML = 'Guardando...';

    try {
        await addDoc(collection(db, "ventas"), datos);
        
        let mensajeExito = '✅ Venta registrada correctamente';
        
        if (datos.estadoPago === 'Parcial') {
            const saldo = parseFloat(datos.saldoPendiente).toFixed(2);
            mensajeExito = `⚠️ Venta registrada. Saldo pendiente: Q${saldo}`;
        } else if (datos.estadoPago === 'Pendiente') {
            mensajeExito = '⏳ Venta registrada como PENDIENTE de pago';
        } else if (datos.estadoPago === 'Pagado') {
            mensajeExito = '✅ Venta registrada y PAGADA totalmente';
        }
        
        mostrarToast(mensajeExito, 'success', true);
        limpiarFormulario();
        
        setTimeout(sugerirSiguienteRecibo, 500);
        
    } catch (error) {
        console.error('Error al guardar:', error);
        mostrarToast('❌ Error al guardar: ' + error.message, 'error', true);
    } finally {
        btnElement.classList.remove('btn-loading');
        btnElement.disabled = false;
        btnElement.innerHTML = textoOriginal;
    }
}

function limpiarFormulario() {
    document.getElementById('ventaForm').reset();
    document.getElementById('fechaVenta').value = new Date().toISOString().split('T')[0];
    document.getElementById('unidadMedida').value = 'libras';
    document.getElementById('precioUnitario').value = '15';
    document.getElementById('metodoPago').value = 'Efectivo';
    document.getElementById('estadoPago').value = 'Pagado';
    document.getElementById('infoCliente').style.display = 'none';
    document.getElementById('otroHongoGroup').style.display = 'none';
    document.getElementById('montoPagadoGroup').style.display = 'none';
    
    // Limpiar mensaje de error
    const errorMsg = document.getElementById('errorRecibo');
    if(errorMsg) errorMsg.textContent = '';
    const inputFactura = document.getElementById('numeroFactura');
    if(inputFactura) {
        inputFactura.style.borderColor = '';
        inputFactura.style.background = '';
    }
    document.getElementById('btnRegistrarVenta').disabled = false;
    document.getElementById('btnRegistrarVenta').style.opacity = '1';
    document.getElementById('btnRegistrarVenta').style.cursor = 'pointer';

    calcularTotales();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    sugerirSiguienteRecibo();
}

function abrirModalCliente() {
    document.getElementById('modalCliente').classList.add('active');
}

function cerrarModalCliente() {
    document.getElementById('modalCliente').classList.remove('active');
    document.getElementById('clienteNombre').value = '';
    document.getElementById('clienteTelefono').value = '';
    document.getElementById('clienteEmail').value = '';
    document.getElementById('clienteDireccion').value = '';
}

async function guardarNuevoCliente() {
    const btn = document.getElementById('btnGuardarCliente');
    const nombre = document.getElementById('clienteNombre').value.trim();
    const telefono = document.getElementById('clienteTelefono').value.trim();
    const email = document.getElementById('clienteEmail').value.trim();
    const direccion = document.getElementById('clienteDireccion').value.trim();
    
    if (!nombre || !telefono) {
        mostrarToast('Nombre y teléfono son obligatorios', 'error', true);
        return;
    }

    btn.classList.add('btn-loading');
    btn.innerHTML = 'Guardando...';

    try {
        const docRef = await addDoc(collection(db, "clientes"), {
            nombre,
            telefono,
            email,
            direccion,
            fechaRegistro: Timestamp.now()
        });

        mostrarToast('Cliente guardado', 'success', true);
        cerrarModalCliente();
        
        // Inyección manual para que aparezca al instante
        const nuevoCliente = {
            id: docRef.id,
            nombre: nombre,
            telefono: telefono,
            email: email,
            direccion: direccion
        };
        clientesGlobal.push(nuevoCliente);
        clientesGlobal.sort((a, b) => a.nombre.localeCompare(b.nombre));
        cargarSelectClientes();
        document.getElementById('clienteId').value = nuevoCliente.id;
        mostrarInfoCliente();

    } catch (error) {
        mostrarToast('Error: ' + error.message, 'error', true);
    } finally {
        btn.classList.remove('btn-loading');
        btn.innerHTML = '💾 Guardar Cliente';
    }
}

// En js/registro-venta.js (reemplaza la función del final)

function configurarMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const navSidebar = document.getElementById('navSidebar');
    const navOverlay = document.getElementById('navOverlay');
    
    // 1. Lógica de abrir/cerrar
    if (menuToggle && navSidebar) {
        function toggle() {
            menuToggle.classList.toggle('active');
            navSidebar.classList.toggle('active');
            navOverlay?.classList.toggle('active');
        }

        menuToggle.addEventListener('click', toggle);
        navOverlay?.addEventListener('click', toggle);
        document.querySelectorAll('.nav-sidebar-link').forEach(l => l.addEventListener('click', toggle));
    }

    // 2. Lógica de "PINTARSE DE VERDE" (Active State)
    const currentPage = window.location.pathname.split('/').pop(); // ej: registro-venta.html
    
    const marcarActivo = (selector) => {
        document.querySelectorAll(selector).forEach(link => {
            const href = link.getAttribute('href');
            // Comparar si el href del link coincide con la pagina actual
            if (href === currentPage) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    };

    marcarActivo('.nav-link');
    marcarActivo('.nav-sidebar-link');
}
