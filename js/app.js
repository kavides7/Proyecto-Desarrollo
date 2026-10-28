// ====================================================
// CREDENCIALES CONFIGURADAS DIRECTAS A TU PROYECTO
// ====================================================
const SUPABASE_URL = "https://falivfgdcqglihwkogvp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbGl2ZmdkY3FnbGlod2tvZ3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDg3NzksImV4cCI6MjEwNjE4NDc3OX0.5MFm-5lohtj5EnZEwMfthcAQUZFUUscasfJgOAoOePQ";

// Inicializar cliente de Supabase
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cache global de existencias para filtrado instantáneo
let cacheInventario = [];

// ====================================================
// ELEMENTOS DEL DOM
// ====================================================
const selectTienda = document.getElementById("select-tienda");
const selectLote = document.getElementById("select-lote");
const tipoMovimiento = document.getElementById("tipo-movimiento");
const inputCantidad = document.getElementById("cantidad");
const inputObservacion = document.getElementById("observacion");
const formMovimiento = document.getElementById("form-movimiento");
const tablaStock = document.getElementById("tabla-stock");
const alerta = document.getElementById("alerta");
const btnRefrescar = document.getElementById("btn-refrescar");
const totalRegistrosStock = document.getElementById("total-registros-stock");

// Filtros interactivos
const inputBuscarStock = document.getElementById("input-buscar-stock");
const filtroTiendaStock = document.getElementById("filtro-tienda-stock");

// Módulo Traslado
const formTraslado = document.getElementById("form-traslado");
const trasladoOrigen = document.getElementById("traslado-origen");
const trasladoDestino = document.getElementById("traslado-destino");
const trasladoLote = document.getElementById("traslado-lote");
const trasladoCantidad = document.getElementById("traslado-cantidad");
const trasladoObservacion = document.getElementById("traslado-observacion");

// ====================================================
// FUNCIONES AUXILIARES
// ====================================================
function mostrarAlerta(mensaje, esError = false) {
  alerta.textContent = mensaje;
  alerta.className = `alerta ${esError ? "alerta-error" : "alerta-exito"}`;
  alerta.classList.remove("oculto");

  setTimeout(() => {
    alerta.classList.add("oculto");
  }, 4500);
}

// Cálculo visual de días para vencimiento
function obtenerBadgeVencimiento(fechaVencimientoStr) {
  if (!fechaVencimientoStr) return `<span class="badge-vence vence-vigente">Sin fecha</span>`;

  const hoy = new Date();
  const fechaVence = new Date(fechaVencimientoStr + "T00:00:00");
  const diferenciaDias = Math.ceil((fechaVence - hoy) / (1000 * 60 * 60 * 24));

  if (diferenciaDias <= 0) {
    return `<span class="badge-vence vence-critico">⛔ Vencido (${fechaVencimientoStr})</span>`;
  } else if (diferenciaDias <= 90) {
    return `<span class="badge-vence vence-alerta">⚠️ Vence en ${diferenciaDias} días</span>`;
  } else {
    return `<span class="badge-vence vence-vigente">✓ Vence: ${fechaVencimientoStr}</span>`;
  }
}

// ====================================================
// CARGA DE CATÁLOGOS (Tiendas y Lotes)
// ====================================================
async function cargarCatalogos() {
  try {
    // 1. Consultar sucursales
    const { data: tiendas, error: errTiendas } = await client
      .from("tiendas")
      .select("id_tienda, nombre, departamento")
      .order("nombre");

    if (errTiendas) throw errTiendas;

    selectTienda.innerHTML = tiendas.length
      ? tiendas.map(t => `<option value="${t.id_tienda}">${t.nombre} (${t.departamento || 'Sacatepéquez'})</option>`).join("")
      : `<option value="">No hay tiendas registradas</option>`;

    const opcionesTiendas = tiendas.map(t => `
      <option value="${t.id_tienda}">${t.nombre}</option>
    `).join("");

    trasladoOrigen.innerHTML = `<option value="">Seleccionar sucursal origen</option>` + opcionesTiendas;
    trasladoDestino.innerHTML = `<option value="">Seleccionar sucursal destino</option>` + opcionesTiendas;

    // Llenar filtro de búsqueda por tienda
    if (filtroTiendaStock) {
      filtroTiendaStock.innerHTML = `<option value="">Todas las sucursales</option>` + opcionesTiendas;
    }

    // 2. Consultar lotes con productos
    const { data: lotes, error: errLotes } = await client
      .from("lotes")
      .select(`
        id_lote,
        id_producto,
        numero_lote,
        fecha_vencimiento,
        fecha_ingreso,
        productos ( nombre )
      `);

    if (errLotes) throw errLotes;

    selectLote.innerHTML = lotes.length
      ? lotes.map(l => `<option value="${l.id_lote}">${l.productos?.nombre || 'Medicamento'} - Lote: ${l.numero_lote}</option>`).join("")
      : `<option value="">No hay lotes registrados</option>`;

    trasladoLote.innerHTML = `<option value="">Seleccionar lote a transferir</option>` +
      lotes.map(l => `
        <option value="${l.id_lote}">
          ${l.productos?.nombre || "Medicamento"} - Lote: ${l.numero_lote}
        </option>
      `).join("");

    // 3. Cargar tabla de existencias
    await consultarStockActual();

  } catch (error) {
    console.error("Error al inicializar catálogos:", error);
    mostrarAlerta("Error al conectar con la base de datos: " + error.message, true);
  }
}

// ====================================================
// CONSULTAR INVENTARIO EN TIEMPO REAL
// ====================================================
async function consultarStockActual() {
  try {
    const { data, error } = await client
      .from("inventario")
      .select(`
        id_inventario,
        stock_actual,
        id_tienda,
        tiendas ( nombre ),
        lotes (
          numero_lote,
          fecha_vencimiento,
          productos ( nombre )
        )
      `)
      .order("id_tienda");

    if (error) throw error;

    cacheInventario = data || [];
    renderizarTablaFiltrada();

  } catch (error) {
    console.error("Error al leer existencias:", error);
    mostrarAlerta("No fue posible cargar el inventario: " + error.message, true);
  }
}

// ====================================================
// RENDERIZADO REACTIVO CON FILTROS EN TIEMPO REAL
// ====================================================
function renderizarTablaFiltrada() {
  const termino = (inputBuscarStock?.value || "").toLowerCase().trim();
  const idTiendaSeleccionada = filtroTiendaStock?.value || "";

  const inventarioFiltrado = cacheInventario.filter(item => {
    const coincideTienda = !idTiendaSeleccionada || item.id_tienda == idTiendaSeleccionada;
    const nombreMed = (item.lotes?.productos?.nombre || "").toLowerCase();
    const lote = (item.lotes?.numero_lote || "").toLowerCase();
    const sucursal = (item.tiendas?.nombre || "").toLowerCase();
    const coincideTexto = !termino || nombreMed.includes(termino) || lote.includes(termino) || sucursal.includes(termino);

    return coincideTienda && coincideTexto;
  });

  if (totalRegistrosStock) {
    totalRegistrosStock.textContent = `${inventarioFiltrado.length} registro(s) encontrado(s)`;
  }

  if (inventarioFiltrado.length === 0) {
    tablaStock.innerHTML = `<tr><td colspan="4" class="texto-centro">No se encontraron existencias con ese criterio de búsqueda.</td></tr>`;
    return;
  }

  tablaStock.innerHTML = inventarioFiltrado.map(item => {
    const tiendaNombre = item.tiendas?.nombre || "Sucursal FARMATODO";
    const productoNombre = item.lotes?.productos?.nombre || "Medicamento";
    const lote = item.lotes?.numero_lote || "N/A";
    const vencimiento = item.lotes?.fecha_vencimiento || null;
    const stock = item.stock_actual;
    const claseStock = stock > 10 ? "stock-alto" : "stock-bajo";
    const badgeVencimiento = obtenerBadgeVencimiento(vencimiento);

    return `
      <tr>
        <td><strong>${tiendaNombre}</strong></td>
        <td><strong>${productoNombre}</strong></td>
        <td>
          <code>${lote}</code><br/>
          ${badgeVencimiento}
        </td>
        <td class="texto-derecha">
          <span class="badge-stock ${claseStock}">${stock} unidades</span>
        </td>
      </tr>
    `;
  }).join("");
}

// ====================================================
// PROCESAR VENTA MEDIANTE PEPS / FIFO
// ====================================================
async function procesarVentaPEPS(idTienda, idLoteSeleccionado, cantidad, observacion) {

  // 1. Averiguar a qué producto pertenece el lote seleccionado
  const { data: loteSeleccionado, error: errorLote } = await client
    .from("lotes")
    .select("id_lote, id_producto")
    .eq("id_lote", idLoteSeleccionado)
    .single();

  if (errorLote) throw errorLote;

  const idProducto = loteSeleccionado.id_producto;

  // 2. Obtener todos los lotes de ese producto ordenados por fecha de ingreso más antigua (PEPS)
  const { data: lotesProducto, error: errorLotes } = await client
    .from("lotes")
    .select("id_lote, numero_lote, fecha_ingreso")
    .eq("id_producto", idProducto)
    .order("fecha_ingreso", { ascending: true })
    .order("id_lote", { ascending: true });

  if (errorLotes) throw errorLotes;

  const idsLotes = lotesProducto.map(lote => lote.id_lote);

  if (idsLotes.length === 0) {
    throw new Error("No existen lotes para este producto.");
  }

  // 3. Consultar inventario disponible de esos lotes en la sucursal seleccionada
  const { data: inventarios, error: errorInventario } = await client
    .from("inventario")
    .select("id_inventario, id_lote, stock_actual")
    .eq("id_tienda", idTienda)
    .in("id_lote", idsLotes)
    .gt("stock_actual", 0);

  if (errorInventario) throw errorInventario;

  // 4. Ordenar según PEPS
  const inventariosOrdenados = lotesProducto
    .map(lote => {
      const inventario = inventarios.find(item => item.id_lote === lote.id_lote);
      if (!inventario) return null;
      return {
        ...inventario,
        numero_lote: lote.numero_lote,
        fecha_ingreso: lote.fecha_ingreso
      };
    })
    .filter(Boolean);

  // 5. Verificar stock TOTAL antes de descontar
  const stockTotal = inventariosOrdenados.reduce((total, item) => total + item.stock_actual, 0);

  if (stockTotal < cantidad) {
    mostrarAlerta(`Operación rechazada: Stock insuficiente. Hay ${stockTotal} unidades disponibles entre los lotes.`, true);
    return false;
  }

  const referenciaVenta = `VENTA-PEPS-${Date.now()}`;
  let cantidadPendiente = cantidad;

  // 6. Consumir lote por lote
  for (const inventario of inventariosOrdenados) {
    if (cantidadPendiente <= 0) break;

    const stockAnterior = inventario.stock_actual;
    const cantidadSalida = Math.min(stockAnterior, cantidadPendiente);
    const nuevoStock = stockAnterior - cantidadSalida;

    // Actualizar inventario
    const { error: errorUpdate } = await client
      .from("inventario")
      .update({ stock_actual: nuevoStock })
      .eq("id_inventario", inventario.id_inventario);

    if (errorUpdate) throw errorUpdate;

    // Registrar en Kardex
    const { error: errorMovimiento } = await client
      .from("movimientos_stock")
      .insert({
        id_tienda: idTienda,
        id_lote: inventario.id_lote,
        tipo_movimiento: "VENTA",
        cantidad: cantidadSalida,
        saldo_anterior: stockAnterior,
        saldo_resultante: nuevoStock,
        referencia: referenciaVenta,
        observacion: observacion || "Venta procesada mediante PEPS / FIFO"
      });

    if (errorMovimiento) throw errorMovimiento;

    cantidadPendiente -= cantidadSalida;
  }

  return true;
}

// ====================================================
// PROCESAR FORMULARIO DE MOVIMIENTO (STOCK)
// ====================================================
formMovimiento.addEventListener("submit", async (e) => {
  e.preventDefault();

  const idTienda = parseInt(selectTienda.value);
  const idLote = parseInt(selectLote.value);
  const tipo = tipoMovimiento.value;
  const cantidad = parseInt(inputCantidad.value);
  const observacion = inputObservacion.value.trim();

  if (isNaN(cantidad) || cantidad <= 0) {
    mostrarAlerta("Ingresa una cantidad válida mayor a 0.", true);
    return;
  }

  if ((tipo === "AJUSTE_POSITIVO" || tipo === "AJUSTE_NEGATIVO") && observacion === "") {
    mostrarAlerta("Debes indicar el motivo del ajuste en la observación.", true);
    return;
  }

  try {
    // Si es VENTA, ejecutar PEPS
    if (tipo === "VENTA") {
      const ventaRealizada = await procesarVentaPEPS(idTienda, idLote, cantidad, observacion);
      if (!ventaRealizada) return;

      mostrarAlerta(`¡Éxito! Venta de ${cantidad} unidades procesada con método PEPS.`);
      formMovimiento.reset();
      await cargarCatalogos();
      return;
    }

    // Para COMPRAS y AJUSTES
    const { data: registroActual, error: errBusq } = await client
      .from("inventario")
      .select("id_inventario, stock_actual")
      .eq("id_tienda", idTienda)
      .eq("id_lote", idLote)
      .maybeSingle();

    if (errBusq) throw errBusq;

    let stockAnterior = registroActual ? registroActual.stock_actual : 0;
    let nuevoStock = stockAnterior;

    if (tipo === "COMPRA" || tipo === "AJUSTE_POSITIVO") {
      nuevoStock = stockAnterior + cantidad;
    } else if (tipo === "AJUSTE_NEGATIVO") {
      if (stockAnterior < cantidad) {
        mostrarAlerta(`Operación rechazada: Stock insuficiente. Solo hay ${stockAnterior} unidades para ajustar.`, true);
        return;
      }
      nuevoStock = stockAnterior - cantidad;
    }

    // Actualizar inventario
    const { error: errUpsert } = await client
      .from("inventario")
      .upsert({
        id_tienda: idTienda,
        id_lote: idLote,
        stock_actual: nuevoStock
      }, { onConflict: "id_tienda,id_lote" });

    if (errUpsert) throw errUpsert;

    // Registrar trazabilidad histórica para Kardex
    const { error: errMovimiento } = await client
      .from("movimientos_stock")
      .insert({
        id_tienda: idTienda,
        id_lote: idLote,
        tipo_movimiento: tipo,
        cantidad: cantidad,
        saldo_anterior: stockAnterior,
        saldo_resultante: nuevoStock,
        observacion: observacion || null
      });

    if (errMovimiento) throw errMovimiento;

    const nombresMovimiento = {
      COMPRA: "Entrada (Compra)",
      AJUSTE_POSITIVO: "Ajuste positivo (+)",
      AJUSTE_NEGATIVO: "Ajuste negativo (-)"
    };

    mostrarAlerta(`¡Éxito! Se registró ${nombresMovimiento[tipo]} de ${cantidad} unidades.`);
    formMovimiento.reset();
    await consultarStockActual();

  } catch (error) {
    console.error("Error al procesar movimiento:", error);
    mostrarAlerta("Error al registrar movimiento: " + error.message, true);
  }
});

// ====================================================
// GESTIÓN DE TRASLADOS ENTRE SUCURSALES
// ====================================================
formTraslado.addEventListener("submit", async (e) => {
  e.preventDefault();

  const idOrigen = parseInt(trasladoOrigen.value);
  const idDestino = parseInt(trasladoDestino.value);
  const idLote = parseInt(trasladoLote.value);
  const cantidad = parseInt(trasladoCantidad.value);
  const observacion = trasladoObservacion.value.trim();

  if (!idOrigen || !idDestino || !idLote) {
    mostrarAlerta("Selecciona sucursal origen, destino y el lote a trasladar.", true);
    return;
  }

  if (idOrigen === idDestino) {
    mostrarAlerta("La sucursal de origen y destino no pueden ser la misma.", true);
    return;
  }

  if (isNaN(cantidad) || cantidad <= 0) {
    mostrarAlerta("La cantidad a trasladar debe ser mayor a 0.", true);
    return;
  }

  try {
    // Validar origen
    const { data: inventarioOrigen, error: errorOrigen } = await client
      .from("inventario")
      .select("id_inventario, stock_actual")
      .eq("id_tienda", idOrigen)
      .eq("id_lote", idLote)
      .maybeSingle();

    if (errorOrigen) throw errorOrigen;

    if (!inventarioOrigen || inventarioOrigen.stock_actual < cantidad) {
      mostrarAlerta(`Stock insuficiente en origen. Disponibles: ${inventarioOrigen ? inventarioOrigen.stock_actual : 0} unidades.`, true);
      return;
    }

    // Consultar destino
    const { data: inventarioDestino, error: errorDestino } = await client
      .from("inventario")
      .select("id_inventario, stock_actual")
      .eq("id_tienda", idDestino)
      .eq("id_lote", idLote)
      .maybeSingle();

    if (errorDestino) throw errorDestino;

    const stockOrigen = inventarioOrigen.stock_actual;
    const stockDestino = inventarioDestino ? inventarioDestino.stock_actual : 0;

    const nuevoOrigen = stockOrigen - cantidad;
    const nuevoDestino = stockDestino + cantidad;
    const referencia = `TRAS-${Date.now()}`;

    // Actualizar origen
    const { error: errorUpdateOrigen } = await client
      .from("inventario")
      .update({ stock_actual: nuevoOrigen })
      .eq("id_inventario", inventarioOrigen.id_inventario);

    if (errorUpdateOrigen) throw errorUpdateOrigen;

    // Actualizar destino
    const { error: errorUpdateDestino } = await client
      .from("inventario")
      .upsert({
        id_tienda: idDestino,
        id_lote: idLote,
        stock_actual: nuevoDestino
      }, { onConflict: "id_tienda,id_lote" });

    if (errorUpdateDestino) throw errorUpdateDestino;

    // Registrar salida por traslado
    await client.from("movimientos_stock").insert({
      id_tienda: idOrigen,
      id_lote: idLote,
      tipo_movimiento: "TRASLADO_SALIDA",
      cantidad,
      saldo_anterior: stockOrigen,
      saldo_resultante: nuevoOrigen,
      referencia,
      observacion: observacion || "Traslado entre sucursales"
    });

    // Registrar entrada por traslado
    await client.from("movimientos_stock").insert({
      id_tienda: idDestino,
      id_lote: idLote,
      tipo_movimiento: "TRASLADO_ENTRADA",
      cantidad,
      saldo_anterior: stockDestino,
      saldo_resultante: nuevoDestino,
      referencia,
      observacion: observacion || "Traslado entre sucursales"
    });

    mostrarAlerta(`¡Traslado exitoso! Referencia: ${referencia}`);
    formTraslado.reset();
    await consultarStockActual();

  } catch (error) {
    console.error("Error realizando traslado:", error);
    mostrarAlerta("No fue posible completar el traslado: " + error.message, true);
  }
});

// ====================================================
// EVENTOS Y FILTROS EN TIEMPO REAL
// ====================================================
btnRefrescar.addEventListener("click", consultarStockActual);
inputBuscarStock.addEventListener("input", renderizarTablaFiltrada);
filtroTiendaStock.addEventListener("change", renderizarTablaFiltrada);

// Inicializar al cargar el DOM
document.addEventListener("DOMContentLoaded", cargarCatalogos);