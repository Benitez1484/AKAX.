// js/informes.js - VERSIÓN CORREGIDA (SOLUCIÓN ZONA HORARIA Y FILTROS)
import { cargarVentas, cargarClientes, formatearFecha, verificarConexion, reintentarConexion, mostrarToast } from './common.js';

let ventasGlobal = [];
let ventasFiltradas = [];
let clientesGlobal = [];

window.reintentarConexionManual = async function() {
    await reintentarConexion();
    window.location.reload();
};

document.addEventListener('DOMContentLoaded', async () => {
    configurarMenu(); 
    const conectado = await verificarConexion();
    
    if (conectado) {
        await cargarInformes();
        configurarEventos();
    } else {
        mostrarToast('Error de conexión. Verifica tu configuración de Firebase.', 'error');
    }
});

function configurarMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const navSidebar = document.getElementById('navSidebar');
    const navOverlay = document.getElementById('navOverlay');
    
    if (!menuToggle || !navSidebar) return;

    function toggle() {
        menuToggle.classList.toggle('active');
        navSidebar.classList.toggle('active');
        navOverlay?.classList.toggle('active');
    }

    menuToggle.addEventListener('click', toggle);
    navOverlay?.addEventListener('click', toggle);
    document.querySelectorAll('.nav-sidebar-link').forEach(l => l.addEventListener('click', toggle));
}

function configurarEventos() {
    document.getElementById('btnAplicarFiltros').addEventListener('click', aplicarFiltros);
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);
    document.getElementById('btnExportar').addEventListener('click', exportarDatosExcel);
    document.getElementById('searchVentas').addEventListener('input', filtrarHistorial);
    document.getElementById('periodoRapido').addEventListener('change', aplicarPeriodoRapido);
}

async function cargarInformes() {
    try {
        ventasGlobal = await cargarVentas();
        clientesGlobal = await cargarClientes();
        
        // Llenar filtro de hongos dinámicamente
        const tiposUnicos = [...new Set(ventasGlobal.map(v => v.tipoHongo).filter(Boolean))];
        const selectHongo = document.getElementById('filtroHongo');
        
        // Guardar selección actual si existe
        const seleccionActual = selectHongo.value;
        
        selectHongo.innerHTML = '<option value="">Todos los productos</option>';
        tiposUnicos.sort().forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo;
            option.textContent = tipo;
            selectHongo.appendChild(option);
        });

        if (seleccionActual) selectHongo.value = seleccionActual;
        
        // Aplicar filtros iniciales (mostrar todo)
        aplicarFiltros();
        
    } catch (error) {
        console.error('Error al cargar informes:', error);
        mostrarToast('Error al cargar informes: ' + error.message, 'error');
    }
}

// Función auxiliar para obtener fecha local YYYY-MM-DD sin errores de zona horaria
function obtenerFechaLocalStr(dateObj) {
    if (!dateObj) return '';
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function aplicarPeriodoRapido() {
    const periodo = document.getElementById('periodoRapido').value;
    if (!periodo) return;
    
    const hoy = new Date();
    let desde = new Date(hoy);
    let hasta = new Date(hoy); // Por defecto hasta es hoy
    
    switch(periodo) {
        case 'hoy':
            // Desde hoy hasta hoy
            break;
        case 'ayer':
            desde.setDate(hoy.getDate() - 1);
            hasta.setDate(hoy.getDate() - 1);
            break;
        case 'semana':
            // Asumiendo semana empieza domingo
            desde.setDate(hoy.getDate() - hoy.getDay());
            break;
        case 'mes':
            desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            break;
        case 'trimestre':
            const mesActual = hoy.getMonth();
            const primerMesTrimestre = Math.floor(mesActual / 3) * 3;
            desde = new Date(hoy.getFullYear(), primerMesTrimestre, 1);
            break;
        case 'ano':
            desde = new Date(hoy.getFullYear(), 0, 1);
            break;
        case 'ultimos7':
            desde.setDate(hoy.getDate() - 6);
            break;
        case 'ultimos30':
            desde.setDate(hoy.getDate() - 29);
            break;
        case 'ultimos90':
            desde.setDate(hoy.getDate() - 89);
            break;
    }
    
    // Establecer valores en los inputs (formato YYYY-MM-DD)
    document.getElementById('fechaDesde').value = obtenerFechaLocalStr(desde);
    document.getElementById('fechaHasta').value = obtenerFechaLocalStr(hasta);
    
    aplicarFiltros();
}

function aplicarFiltros() {
    console.log("Aplicando filtros..."); // Debug
    
    // 1. Obtener valores de los inputs (TEXTO PURO)
    const fechaDesdeStr = document.getElementById('fechaDesde').value; // "2025-12-01"
    const fechaHastaStr = document.getElementById('fechaHasta').value; // "2025-12-09"
    const filtroHongo = document.getElementById('filtroHongo').value;
    const filtroEstado = document.getElementById('filtroEstado').value;
    
    // 2. Filtrar
    ventasFiltradas = ventasGlobal.filter(venta => {
        // --- FILTRO DE FECHA (POR TEXTO) ---
        // Convertimos la fecha de la venta a "YYYY-MM-DD" local
        const fechaVentaObj = venta.fecha.toDate ? venta.fecha.toDate() : new Date(venta.fecha);
        const fechaVentaStr = obtenerFechaLocalStr(fechaVentaObj);
        
        // Comparación alfanumérica de strings ISO ("2025-12-01" < "2025-12-02")
        if (fechaDesdeStr && fechaVentaStr < fechaDesdeStr) return false;
        if (fechaHastaStr && fechaVentaStr > fechaHastaStr) return false;
        
        // --- FILTROS DE CATEGORÍA ---
        // Usamos trim() para evitar errores por espacios accidentales "Pagado " vs "Pagado"
        if (filtroHongo && venta.tipoHongo?.trim() !== filtroHongo.trim()) return false;
        if (filtroEstado && venta.estadoPago?.trim() !== filtroEstado.trim()) return false;
        
        return true;
    });
    
    // 3. Actualizar UI de texto informativo
    actualizarInfoPeriodo(fechaDesdeStr, fechaHastaStr, ventasFiltradas.length);
    
    // 4. Recalcular todo
    calcularResumenGeneral(ventasFiltradas);
    calcularTendencias(ventasFiltradas);
    calcularMetricasPago(ventasFiltradas);
    calcularMetricasProducto(ventasFiltradas);
    cargarTopClientes(ventasFiltradas);
    cargarVentasPorHongo(ventasFiltradas);
    cargarVentasPorMetodo(ventasFiltradas);
    cargarHistorialVentas(ventasFiltradas);
}

function actualizarInfoPeriodo(desdeStr, hastaStr, cantidad) {
    const periodInfo = document.getElementById('periodInfo');
    const periodText = document.getElementById('periodText');
    
    if (desdeStr || hastaStr) {
        periodInfo.style.display = 'block';
        
        // Función para convertir "2025-12-01" a "01/12/2025" MANUALMENTE
        // Esto evita que new Date() le reste un día por zona horaria
        const formatearBonito = (isoStr) => {
            if (!isoStr) return '...';
            const [year, month, day] = isoStr.split('-');
            return `${day}/${month}/${year}`;
        };
        
        const textoDesde = desdeStr ? formatearBonito(desdeStr) : 'Inicio';
        const textoHasta = hastaStr ? formatearBonito(hastaStr) : 'Hoy';
        
        periodText.textContent = `${textoDesde} - ${textoHasta} (${cantidad} ventas)`;
        
        // Si hay 0 ventas, dar una pista visual
        if (cantidad === 0) {
            periodText.innerHTML += ' <span style="color:var(--color-danger); margin-left:10px;">⚠️ No se encontraron resultados</span>';
        }
    } else {
        periodInfo.style.display = 'none';
    }
}

function limpiarFiltros() {
    document.getElementById('fechaDesde').value = '';
    document.getElementById('fechaHasta').value = '';
    document.getElementById('filtroHongo').value = '';
    document.getElementById('filtroEstado').value = '';
    document.getElementById('periodoRapido').value = '';
    
    aplicarFiltros();
}

// ==================== CÁLCULOS (Lógica de Negocio) ====================

function calcularResumenGeneral(ventas) {
    const totalIngresos = ventas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
    const cantidadTotal = ventas.reduce((sum, v) => sum + parseFloat(v.cantidad || 0), 0);
    const ticketPromedio = ventas.length > 0 ? totalIngresos / ventas.length : 0;
    
    document.getElementById('totalIngresos').textContent = `Q${totalIngresos.toFixed(2)}`;
    document.getElementById('totalVentas').textContent = ventas.length;
    document.getElementById('cantidadTotal').textContent = cantidadTotal.toFixed(2);
    document.getElementById('ticketPromedio').textContent = `Q${ticketPromedio.toFixed(2)}`;
    
    const dias = Math.max(1, calcularDiasRango());
    document.getElementById('detalleIngresos').textContent = ventas.length > 0 ? 
        `${ventas.length} transacciones` : 'Sin ventas';
    document.getElementById('detalleVentas').textContent = 
        `${(ventas.length > 0 ? (ventas.length / dias) : 0).toFixed(1)} por día`;
    document.getElementById('detalleCantidad').textContent = 
        `${(cantidadTotal > 0 ? (cantidadTotal / dias) : 0).toFixed(1)} lbs por día`;
    document.getElementById('detalleTicket').textContent = 
        `Rango: Q${calcularRangoTicket(ventas)}`;
}

function calcularDiasRango() {
    const desde = document.getElementById('fechaDesde').value;
    const hasta = document.getElementById('fechaHasta').value;
    if (!desde || !hasta) return 30;
    
    // Parseo manual YYYY-MM-DD para evitar UTC offset
    const d1 = new Date(desde + 'T00:00:00');
    const d2 = new Date(hasta + 'T00:00:00');
    
    const diff = Math.abs(d2 - d1);
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
}

function calcularRangoTicket(ventas) {
    if (ventas.length === 0) return '0.00 - 0.00';
    const totales = ventas.map(v => parseFloat(v.total || 0));
    const min = Math.min(...totales);
    const max = Math.max(...totales);
    return `${min.toFixed(2)} - ${max.toFixed(2)}`;
}

function calcularTendencias(ventas) {
    const dias = calcularDiasRango();
    const totalIngresos = ventas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
    const promedioIngresos = dias > 0 ? totalIngresos / dias : 0;
    const promedioVentas = dias > 0 ? ventas.length / dias : 0;
    
    document.getElementById('promedioIngresosDiarios').textContent = `Q${promedioIngresos.toFixed(2)}/día`;
    document.getElementById('promedioVentasDiarias').textContent = `${promedioVentas.toFixed(1)}/día`;
    
    const maxIngresosDiarios = 5000;
    const maxVentasDiarias = 20;
    
    const porcentajeIngresos = Math.min((promedioIngresos / maxIngresosDiarios) * 100, 100);
    const porcentajeVentas = Math.min((promedioVentas / maxVentasDiarias) * 100, 100);
    
    document.getElementById('trendIngresos').style.width = `${porcentajeIngresos}%`;
    document.getElementById('trendVentas').style.width = `${porcentajeVentas}%`;
}

function calcularMetricasPago(ventas) {
    let pagosPagados = 0;
    let pagosPendientes = 0;
    let pagosParciales = 0;
    
    ventas.forEach(v => {
        const total = parseFloat(v.total || 0);
        if (v.estadoPago === 'Pagado') {
            pagosPagados += total;
        } else if (v.estadoPago === 'Pendiente') {
            pagosPendientes += total;
        } else if (v.estadoPago === 'Parcial') {
            pagosParciales += total;
        }
    });
    
    const totalGeneral = pagosPagados + pagosPendientes + pagosParciales;
    const tasaCobro = totalGeneral > 0 ? (pagosPagados / totalGeneral) * 100 : 0;
    
    document.getElementById('pagosPagados').textContent = `Q${pagosPagados.toFixed(2)}`;
    document.getElementById('pagosPendientes').textContent = `Q${pagosPendientes.toFixed(2)}`;
    document.getElementById('pagosParciales').textContent = `Q${pagosParciales.toFixed(2)}`;
    document.getElementById('tasaCobro').textContent = `${tasaCobro.toFixed(1)}%`;
}

function calcularMetricasProducto(ventas) {
    if (ventas.length === 0) {
        document.getElementById('productoTop').textContent = 'Sin datos';
        document.getElementById('calidadTop').textContent = 'Sin datos';
        document.getElementById('precioPromedio').textContent = 'Q0.00';
        document.getElementById('descuentoPromedio').textContent = 'Q0.00';
        return;
    }
    
    const productosCont = {};
    ventas.forEach(v => {
        const tipo = v.tipoHongo || 'Sin especificar';
        productosCont[tipo] = (productosCont[tipo] || 0) + 1;
    });
    const productoTop = Object.entries(productosCont).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('productoTop').textContent = productoTop ? 
        `${productoTop[0]} (${productoTop[1]})` : 'Sin datos';
    
    document.getElementById('calidadTop').textContent = productoTop ? productoTop[0] : 'N/A';
    
    const precioPromedio = ventas.reduce((sum, v) => sum + parseFloat(v.precioUnitario || 0), 0) / ventas.length;
    document.getElementById('precioPromedio').textContent = `Q${precioPromedio.toFixed(2)}`;
    
    const descuentoPromedio = ventas.reduce((sum, v) => sum + parseFloat(v.descuentoAplicado || 0), 0) / ventas.length;
    document.getElementById('descuentoPromedio').textContent = `Q${descuentoPromedio.toFixed(2)}`;
}

function cargarTopClientes(ventas) {
    const tbody = document.getElementById('topClientesTable');
    
    if (ventas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay datos para mostrar</td></tr>';
        return;
    }
    
    const clientesStats = {};
    ventas.forEach(v => {
        const clienteId = v.clienteId || 'sin-id';
        const clienteNombre = v.clienteNombre || 'Cliente General';
        
        if (!clientesStats[clienteId]) {
            clientesStats[clienteId] = {
                nombre: clienteNombre,
                compras: 0,
                totalGastado: 0,
                ultimaCompra: v.fecha
            };
        }
        
        clientesStats[clienteId].compras += 1;
        clientesStats[clienteId].totalGastado += parseFloat(v.total || 0);
        
        const fechaActual = v.fecha.toDate ? v.fecha.toDate() : new Date(v.fecha);
        const fechaGuardada = clientesStats[clienteId].ultimaCompra.toDate ? 
            clientesStats[clienteId].ultimaCompra.toDate() : new Date(clientesStats[clienteId].ultimaCompra);
        
        if (fechaActual > fechaGuardada) {
            clientesStats[clienteId].ultimaCompra = v.fecha;
        }
    });
    
    const topClientes = Object.values(clientesStats)
        .sort((a, b) => b.totalGastado - a.totalGastado)
        .slice(0, 10);
    
    tbody.innerHTML = topClientes.map((cliente, index) => {
        const ticketPromedio = cliente.totalGastado / cliente.compras;
        return `
            <tr>
                <td style="font-weight: 700; color: var(--color-primary);">${index + 1}</td>
                <td style="font-weight: 600;">${cliente.nombre}</td>
                <td>${cliente.compras}</td>
                <td style="font-weight: 700; color: var(--color-success);">Q${cliente.totalGastado.toFixed(2)}</td>
                <td>Q${ticketPromedio.toFixed(2)}</td>
                <td style="font-size: 0.9rem;">${formatearFecha(cliente.ultimaCompra)}</td>
            </tr>
        `;
    }).join('');
}

function cargarVentasPorHongo(ventas) {
    const tbody = document.getElementById('ventasPorHongoTable');
    if (ventas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay datos para mostrar</td></tr>';
        return;
    }
    
    const totalGeneral = ventas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
    const ventasPorHongo = {};
    
    ventas.forEach(v => {
        const tipo = v.tipoHongo || 'Sin especificar';
        if (!ventasPorHongo[tipo]) ventasPorHongo[tipo] = { cantidad: 0, numVentas: 0, total: 0 };
        ventasPorHongo[tipo].cantidad += parseFloat(v.cantidad || 0);
        ventasPorHongo[tipo].numVentas += 1;
        ventasPorHongo[tipo].total += parseFloat(v.total || 0);
    });
    
    tbody.innerHTML = Object.entries(ventasPorHongo)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([tipo, data]) => {
            const porcentaje = totalGeneral > 0 ? ((data.total / totalGeneral) * 100).toFixed(1) : 0;
            return `
            <tr>
                <td style="font-weight: 600;">🍄 ${tipo}</td>
                <td>${data.cantidad.toFixed(2)} lbs</td>
                <td>${data.numVentas}</td>
                <td style="font-weight: 700; color: var(--color-success);">Q${data.total.toFixed(2)}</td>
                <td>Q${(data.total / data.numVentas).toFixed(2)}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-weight: 600;">${porcentaje}%</span>
                        <div style="flex: 1; max-width: 80px; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${porcentaje}%; height: 100%; background: var(--color-success);"></div>
                        </div>
                    </div>
                </td>
            </tr>
        `}).join('');
}

function cargarVentasPorMetodo(ventas) {
    const tbody = document.getElementById('ventasPorMetodoTable');
    if (ventas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay datos para mostrar</td></tr>';
        return;
    }
    
    const ventasPorMetodo = {};
    const totalGeneral = ventas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
    
    ventas.forEach(v => {
        const metodo = v.metodoPago || 'No especificado';
        if (!ventasPorMetodo[metodo]) ventasPorMetodo[metodo] = { cantidad: 0, total: 0 };
        ventasPorMetodo[metodo].cantidad += 1;
        ventasPorMetodo[metodo].total += parseFloat(v.total || 0);
    });
    
    const iconos = { 'Efectivo': '💵', 'Transferencia': '🏦', 'Tarjeta': '💳', 'Cheque': '📝', 'Otro': '🔄' };
    
    tbody.innerHTML = Object.entries(ventasPorMetodo)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([metodo, data]) => {
            const porcentaje = totalGeneral > 0 ? ((data.total / totalGeneral) * 100).toFixed(1) : 0;
            const promedio = data.cantidad > 0 ? data.total / data.cantidad : 0;
            return `
            <tr>
                <td style="font-weight: 600;">${iconos[metodo] || '💰'} ${metodo}</td>
                <td>${data.cantidad}</td>
                <td style="font-weight: 700; color: var(--color-success);">Q${data.total.toFixed(2)}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-weight: 600;">${porcentaje}%</span>
                        <div style="flex: 1; max-width: 100px; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${porcentaje}%; height: 100%; background: var(--color-secondary);"></div>
                        </div>
                    </div>
                </td>
                <td>Q${promedio.toFixed(2)}</td>
            </tr>
        `}).join('');
}

function cargarHistorialVentas(ventas) {
    const tbody = document.getElementById('historialVentasTable');
    if (ventas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay ventas en este período</td></tr>';
        return;
    }
    
    const ventasOrdenadas = [...ventas].sort((a, b) => {
        const fechaA = a.fecha.toDate ? a.fecha.toDate() : new Date(a.fecha);
        const fechaB = b.fecha.toDate ? b.fecha.toDate() : new Date(b.fecha);
        return fechaB - fechaA;
    });
    
    tbody.innerHTML = ventasOrdenadas.map(venta => {
        const estadoBadge = getEstadoBadge(venta.estadoPago);
        return `
        <tr>
            <td style="white-space: nowrap; font-size: 0.9rem;">${formatearFecha(venta.fecha)}</td>
            <td style="font-weight: 500;">${venta.clienteNombre || 'N/A'}</td>
            <td>${venta.tipoHongo || 'N/A'}</td>
            <td>${parseFloat(venta.cantidad || 0).toFixed(2)} ${venta.unidadMedida || ''}</td>
            <td>${venta.metodoPago || 'N/A'}</td>
            <td>${estadoBadge}</td>
            <td style="font-weight: 700; color: var(--color-success);">Q${parseFloat(venta.total || 0).toFixed(2)}</td>
        </tr>
    `}).join('');
}

function getEstadoBadge(estado) {
    const badges = {
        'Pagado': '<span class="badge badge-success">✅ Pagado</span>',
        'Pendiente': '<span class="badge badge-warning">⏳ Pendiente</span>',
        'Parcial': '<span class="badge badge-info">📊 Parcial</span>'
    };
    return badges[estado] || '<span class="badge">Sin estado</span>';
}

function filtrarHistorial(e) {
    const searchTerm = e.target.value.toLowerCase();
    const ventasBuscadas = searchTerm ? 
        ventasFiltradas.filter(v => 
            v.clienteNombre?.toLowerCase().includes(searchTerm) ||
            v.tipoHongo?.toLowerCase().includes(searchTerm) ||
            v.metodoPago?.toLowerCase().includes(searchTerm)
        ) : ventasFiltradas;
    cargarHistorialVentas(ventasBuscadas);
}

function exportarDatosExcel() {
    if (ventasFiltradas.length === 0) {
        mostrarToast('No hay datos para exportar', 'warning');
        return;
    }
    if (typeof XLSX === 'undefined') {
        mostrarToast('Error: La librería de Excel no se cargó correctamente.', 'error');
        return;
    }

    try {
        const encabezados = ['Fecha', 'Cliente', 'Hongo', 'Cantidad', 'Unidad', 'Método Pago', 'Estado', 'Precio Unit.', 'Subtotal', 'Descuento', 'Total'];
        const datos = ventasFiltradas.map(v => {
            const fechaObj = v.fecha.toDate ? v.fecha.toDate() : new Date(v.fecha);
            return [
                fechaObj.toLocaleDateString('es-GT'),
                v.clienteNombre || 'Cliente General',
                v.tipoHongo || '',
                parseFloat(v.cantidad || 0),
                v.unidadMedida || '',
                v.metodoPago || '',
                v.estadoPago || '',
                parseFloat(v.precioUnitario || 0),
                parseFloat(v.subtotal || 0),
                parseFloat(v.descuentoAplicado || 0),
                parseFloat(v.total || 0)
            ];
        });

        const datosCompleto = [encabezados, ...datos];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(datosCompleto);
        
        ws['!cols'] = [{wch: 12}, {wch: 25}, {wch: 15}, {wch: 10}, {wch: 10}, {wch: 15}, {wch: 12}, {wch: 12}, {wch: 12}, {wch: 12}, {wch: 12}];
        XLSX.utils.book_append_sheet(wb, ws, "Informe de Ventas");

        const fechaDesde = document.getElementById('fechaDesde').value || 'Completo';
        const fechaHasta = document.getElementById('fechaHasta').value || 'Completo';
        XLSX.writeFile(wb, `Informe_Ventas_${fechaDesde}_al_${fechaHasta}.xlsx`);
        mostrarToast('✅ Informe Excel descargado', 'success');
    } catch (error) {
        console.error("Error:", error);
        mostrarToast('Error al generar Excel: ' + error.message, 'error');
    }
}