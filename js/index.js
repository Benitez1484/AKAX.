// js/index.js - INICIO POR DEFECTO: HOY
import { cargarVentas, verificarConexion, reintentarConexion, mostrarToast } from './common.js';

let ventasGlobal = [];
let periodoActual = 'hoy'; // ✅ CAMBIO: Ahora inicia en 'hoy'

window.reintentarConexionManual = async function() {
    await reintentarConexion();
    await cargarDashboard();
};

document.addEventListener('DOMContentLoaded', async () => {
    configurarMenu(); // Lógica del menú
    const conectado = await verificarConexion();
    
    if (conectado) {
        await cargarDashboard();
        configurarFiltrosPeriodo();
    } else {
        mostrarErrorConexion();
    }
});
// En js/index.js (reemplaza la función del final)

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
    // Obtener nombre del archivo actual (ej: index.html)
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    const marcarActivo = (selector) => {
        document.querySelectorAll(selector).forEach(link => {
            const href = link.getAttribute('href');
            // Si el link coincide con la página actual
            if (href === currentPage || (currentPage === '' && href === 'index.html')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active'); // Limpiar por si acaso
            }
        });
    };

    marcarActivo('.nav-link');          // Para escritorio
    marcarActivo('.nav-sidebar-link');  // Para celular
}
  

function configurarFiltrosPeriodo() {
    const botones = document.querySelectorAll('.btn-periodo');
    
    // 1. Sincronizar botones visualmente al cargar
    botones.forEach(btn => {
        // Si el botón coincide con el periodo actual ('hoy'), activarlo. Si no, desactivarlo.
        if (btn.dataset.periodo === periodoActual) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }

        // 2. Agregar evento click
        btn.addEventListener('click', () => {
            // Remover active de todos
            botones.forEach(b => b.classList.remove('active'));
            // Agregar active al clickeado
            btn.classList.add('active');
            
            // Cambiar período actual
            periodoActual = btn.dataset.periodo;
            
            // Actualizar dashboard
            aplicarFiltroPeriodo();
        });
    });
}

function aplicarFiltroPeriodo() {
    const ventasFiltradas = filtrarVentasPorPeriodo(ventasGlobal, periodoActual);
    
    // Actualizar texto del período
    const textos = {
        'hoy': 'Hoy',
        'semana': 'Esta Semana',
        'mes': 'Este Mes',
        'trimestre': 'Este Trimestre',
        'ano': 'Este Año',
        'todo': 'Todo el Histórico'
    };
    
    const fechas = obtenerRangoFechas(periodoActual);
    const textoFechas = fechas ? 
        ` (${fechas.desde.toLocaleDateString('es-GT')} - ${fechas.hasta.toLocaleDateString('es-GT')})` : '';
    
    const spanPeriodo = document.getElementById('periodoTexto');
    if (spanPeriodo) {
        spanPeriodo.textContent = textos[periodoActual] + textoFechas;
    }
    
    // Actualizar estadísticas
    const stats = calcularEstadisticasDashboard(ventasFiltradas);
    document.getElementById('totalVentas').textContent = `Q${stats.totalVentas}`;
    document.getElementById('numeroVentas').textContent = stats.numeroVentas;
    document.getElementById('cantidadTotal').textContent = stats.cantidadTotal;
    document.getElementById('promedioVenta').textContent = `Q${stats.promedioVenta}`;
    
    // Cargar últimas ventas (las más recientes del período)
    cargarUltimasVentas(ventasFiltradas.slice(0, 5));
}

// ✅ Función corregida para evitar problemas de zona horaria con "Hoy"
function obtenerRangoFechas(periodo) {
    const hoy = new Date();
    // Normalizar "hoy" al inicio del día para comparaciones correctas
    const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    
    let desde, hasta = new Date(hoy);
    hasta.setHours(23, 59, 59, 999);
    
    switch(periodo) {
        case 'hoy':
            desde = new Date(inicioDia);
            break;
        case 'semana':
            desde = new Date(inicioDia);
            desde.setDate(desde.getDate() - hoy.getDay()); // Domingo de esta semana
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
        case 'todo':
            return null; // Sin filtro
        default:
            desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    }
    
    return { desde, hasta };
}

function filtrarVentasPorPeriodo(ventas, periodo) {
    if (periodo === 'todo') {
        return ventas;
    }
    
    const rango = obtenerRangoFechas(periodo);
    if (!rango) return ventas;
    
    return ventas.filter(venta => {
        const fechaVenta = venta.fecha.toDate ? venta.fecha.toDate() : new Date(venta.fecha);
        return fechaVenta >= rango.desde && fechaVenta <= rango.hasta;
    });
}

async function cargarDashboard() {
    try {
        const tabla = document.getElementById('recentSalesTable');
        if (tabla) tabla.innerHTML = '<tr><td colspan="4" class="text-center"><div class="spinner"></div></td></tr>';
        
        ventasGlobal = await cargarVentas();
        
        // Aplicar filtro del período actual (ahora por defecto "hoy")
        aplicarFiltroPeriodo();
        
    } catch (error) {
        console.error('Error al cargar dashboard:', error);
        mostrarToast('Error al cargar el dashboard: ' + error.message, 'error');
        mostrarErrorConexion();
    }
}

function calcularEstadisticasDashboard(ventas) {
    if (!ventas || ventas.length === 0) {
        return {
            totalVentas: '0.00',
            numeroVentas: 0,
            cantidadTotal: '0.00',
            promedioVenta: '0.00'
        };
    }
    
    const totalVentas = ventas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
    const numeroVentas = ventas.length;
    const cantidadTotal = ventas.reduce((sum, v) => sum + parseFloat(v.cantidad || 0), 0);
    const promedioVenta = numeroVentas > 0 ? totalVentas / numeroVentas : 0;
    
    return {
        totalVentas: totalVentas.toFixed(2),
        numeroVentas: numeroVentas,
        cantidadTotal: cantidadTotal.toFixed(2),
        promedioVenta: promedioVenta.toFixed(2)
    };
}

function cargarUltimasVentas(ventas) {
    const tbody = document.getElementById('recentSalesTable');
    if (!tbody) return;
    
    if (!ventas || ventas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay ventas registradas en este período</td></tr>';
        return;
    }
    
    tbody.innerHTML = ventas.map(venta => {
        const cliente = venta.clienteNombre || 'Cliente sin nombre';
        const hongo = venta.tipoHongo || 'Hongo sin especificar';
        const cantidad = parseFloat(venta.cantidad || 0).toFixed(2);
        const unidad = venta.unidadMedida || 'lbs';
        const total = parseFloat(venta.total || 0).toFixed(2);
        
        return `
            <tr>
                <td style="font-weight: 500;">${cliente}</td>
                <td>${hongo}</td>
                <td>${cantidad} ${unidad}</td>
                <td style="font-weight: 700; color: var(--color-success);">Q${total}</td>
            </tr>
        `;
    }).join('');
}

function mostrarErrorConexion() {
    const tabla = document.getElementById('recentSalesTable');
    if (tabla) {
        tabla.innerHTML = '<tr><td colspan="4" class="text-center" style="color: var(--color-danger); padding: 2rem;">Error de conexión. Verifica tu configuración de Firebase.</td></tr>';
    }
    
    document.getElementById('totalVentas').textContent = 'Q0.00';
    document.getElementById('numeroVentas').textContent = '0';
    document.getElementById('cantidadTotal').textContent = '0';
    document.getElementById('promedioVenta').textContent = 'Q0.00';

}
