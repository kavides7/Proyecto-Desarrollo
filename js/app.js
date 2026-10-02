// ====================================================
// CREDENCIALES CONFIGURADAS DIRECTAS A TU PROYECTO
// ====================================================
const SUPABASE_URL = "https://falivfgdcqglihwkogvp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbGl2ZmdkY3FnbGlod2tvZ3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDg3NzksImV4cCI6MjEwNjE4NDc3OX0.5MFm-5lohtj5EnZEwMfthcAQUZFUUscasfJgOAoOePQ";

// Inicializar cliente de Supabase
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

// ====================================================
// CARGA DE CATÁLOGOS (Tiendas y Lotes)
// ====================================================
async function cargarCatalogos() {
  try {
    // 1. Consultar sucursales
    const { data: tiendas, error: errTiendas } = await client
      .from("tiendas")
      .select("id_tienda, nombre, departamento");

    if (errTiendas) throw errTiendas;

    selectTienda.innerHTML = tiendas.length
      ? tiendas.map(t => `<option value="${t.id_tienda}">${t.nombre} (${t.departamento || 'Huehue'})</option>`).join("")
      : `<option value="">No hay tiendas registradas</option>`;

    const opcionesTiendas = tiendas.map(t => `
      <option value="${t.id_tienda}">
        ${t.nombre}
      </option>
    `).join("");

    trasladoOrigen.innerHTML =
      `<option value="">Seleccionar sucursal</option>` +
      opcionesTiendas;

    trasladoDestino.innerHTML =
      `<option value="">Seleccionar sucursal</option>` +
      opcionesTiendas;  

    // 2. Consultar lotes con la relación a medicamentos
    const { data: lotes, error: errLotes } = await client
      .from("lotes")
      .select("id_lote, numero_lote, fecha_vencimiento, productos(nombre)");

    if (errLotes) throw errLotes;

    selectLote.innerHTML = lotes.length
      ? lotes.map(l => `<option value="${l.id_lote}">${l.productos?.nombre || 'Medicamento'} - Lote: ${l.numero_lote}</option>`).join("")
      : `<option value="">No hay lotes registrados</option>`;

    // 3. Cargar tabla de existencias
    await consultarStockActual();

      trasladoLote.innerHTML =
    `<option value="">Seleccionar lote</option>` +
    lotes.map(l => `
      <option value="${l.id_lote}">
        ${l.productos?.nombre || "Medicamento"} -
        Lote ${l.numero_lote}
      </option>
    `).join("");

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
        stock_actual,
        tiendas ( nombre ),
        lotes (
          numero_lote,
          fecha_vencimiento,
          productos ( nombre )
        )
      `);

    if (error) throw error;

    if (!data || data.length === 0) {
      tablaStock.innerHTML = `<tr><td colspan="4" class="texto-centro">No hay existencias registradas todavía.</td></tr>`;
      return;
    }

    tablaStock.innerHTML = data.map(item => {
      const tiendaNombre = item.tiendas?.nombre || "Sucursal Huehue";
      const productoNombre = item.lotes?.productos?.nombre || "Producto";
      const lote = item.lotes?.numero_lote || "N/A";
      const vencimiento = item.lotes?.fecha_vencimiento || "--";
      const stock = item.stock_actual;
      const claseStock = stock > 10 ? "stock-alto" : "stock-bajo";

      return `
        <tr>
          <td><strong>${tiendaNombre}</strong></td>
          <td>${productoNombre}</td>
          <td><code>${lote}</code> <small style="color: #64748b;">(Vence: ${vencimiento})</small></td>
          <td class="texto-derecha">
            <span class="badge-stock ${claseStock}">${stock} unidades</span>
          </td>
        </tr>
      `;
    }).join("");

  } catch (error) {
    console.error("Error al leer existencias:", error);
    mostrarAlerta("No fue posible cargar el inventario: " + error.message, true);
  }
}

// ====================================================
// PROCESAR ENTRADAS / SALIDAS (CONTROL DE STOCK)
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

  if (
  (tipo === "AJUSTE_POSITIVO" || tipo === "AJUSTE_NEGATIVO")
  && observacion === ""
) {
  mostrarAlerta(
    "Debes indicar el motivo del ajuste de inventario.",
    true
  );
  return;
}

  try {
    // 1. Buscar si ya existe el registro de inventario para esa tienda y lote
    const { data: registroActual, error: errBusq } = await client
      .from("inventario")
      .select("id_inventario, stock_actual")
      .eq("id_tienda", idTienda)
      .eq("id_lote", idLote)
      .maybeSingle();

    if (errBusq) throw errBusq;

    let stockAnterior = registroActual ? registroActual.stock_actual : 0;
    let nuevoStock = stockAnterior;

    // 2. Aplicar lógica de negocio
    if (tipo === "COMPRA" || tipo === "AJUSTE_POSITIVO") {

      nuevoStock = stockAnterior + cantidad;

    } else if (tipo === "VENTA" || tipo === "AJUSTE_NEGATIVO") {

      if (stockAnterior < cantidad) {
        mostrarAlerta(
          `Operación rechazada: Stock insuficiente. Solo hay ${stockAnterior} unidades disponibles.`,
          true
        );
        return;
      }

      nuevoStock = stockAnterior - cantidad;

    } else {

      mostrarAlerta("Tipo de movimiento no válido.", true);
      return;
    }

    // 3. Actualizar tabla inventario
    const { error: errUpsert } = await client
      .from("inventario")
      .upsert({
        id_tienda: idTienda,
        id_lote: idLote,
        stock_actual: nuevoStock
      }, { onConflict: "id_tienda,id_lote" });

    if (errUpsert) throw errUpsert;

    // 4. Guardar trazabilidad en movimientos_stock
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
      VENTA: "Salida (Venta)",
      AJUSTE_POSITIVO: "Ajuste positivo",
      AJUSTE_NEGATIVO: "Ajuste negativo"
    };

    mostrarAlerta(
      `¡Éxito! Se registró ${nombresMovimiento[tipo]} de ${cantidad} unidades.`
    );
        
    // Recargar tabla con datos actualizados
    await consultarStockActual();

  } catch (error) {
    console.error("Error al procesar movimiento:", error);
    mostrarAlerta("Error al registrar movimiento: " + error.message, true);
  }
});

// Evento botón actualizar
btnRefrescar.addEventListener("click", consultarStockActual);

formTraslado.addEventListener("submit", async (e) => {

  e.preventDefault();

  const idOrigen = parseInt(trasladoOrigen.value);
  const idDestino = parseInt(trasladoDestino.value);
  const idLote = parseInt(trasladoLote.value);
  const cantidad = parseInt(trasladoCantidad.value);
  const observacion = trasladoObservacion.value.trim();

  if (!idOrigen || !idDestino || !idLote) {
    mostrarAlerta(
      "Selecciona origen, destino y lote.",
      true
    );
    return;
  }

  if (idOrigen === idDestino) {
    mostrarAlerta(
      "La sucursal de origen y destino no pueden ser iguales.",
      true
    );
    return;
  }

  if (isNaN(cantidad) || cantidad <= 0) {
    mostrarAlerta(
      "La cantidad del traslado debe ser mayor a 0.",
      true
    );
    return;
  }

  try {

    // INVENTARIO ORIGEN
    const {
      data: inventarioOrigen,
      error: errorOrigen
    } = await client
      .from("inventario")
      .select("id_inventario, stock_actual")
      .eq("id_tienda", idOrigen)
      .eq("id_lote", idLote)
      .maybeSingle();

    if (errorOrigen) throw errorOrigen;

    if (!inventarioOrigen) {
      mostrarAlerta(
        "La sucursal de origen no posee este lote.",
        true
      );
      return;
    }

    const stockOrigen =
      inventarioOrigen.stock_actual;

    if (stockOrigen < cantidad) {
      mostrarAlerta(
        `Stock insuficiente. La sucursal origen posee ${stockOrigen} unidades.`,
        true
      );
      return;
    }


    // INVENTARIO DESTINO
    const {
      data: inventarioDestino,
      error: errorDestino
    } = await client
      .from("inventario")
      .select("id_inventario, stock_actual")
      .eq("id_tienda", idDestino)
      .eq("id_lote", idLote)
      .maybeSingle();

    if (errorDestino) throw errorDestino;

    const stockDestino =
      inventarioDestino
        ? inventarioDestino.stock_actual
        : 0;


    const nuevoOrigen =
      stockOrigen - cantidad;

    const nuevoDestino =
      stockDestino + cantidad;


    // REFERENCIA DEL TRASLADO
    const referencia =
      `TRAS-${Date.now()}`;


    // ACTUALIZAR ORIGEN
    const { error: errorUpdateOrigen } =
      await client
        .from("inventario")
        .update({
          stock_actual: nuevoOrigen
        })
        .eq(
          "id_inventario",
          inventarioOrigen.id_inventario
        );

    if (errorUpdateOrigen)
      throw errorUpdateOrigen;


    // ACTUALIZAR / CREAR DESTINO
    const { error: errorUpdateDestino } =
      await client
        .from("inventario")
        .upsert({
          id_tienda: idDestino,
          id_lote: idLote,
          stock_actual: nuevoDestino
        }, {
          onConflict: "id_tienda,id_lote"
        });

    if (errorUpdateDestino)
      throw errorUpdateDestino;


    // REGISTRAR SALIDA
    const { error: errorMovimientoSalida } =
      await client
        .from("movimientos_stock")
        .insert({
          id_tienda: idOrigen,
          id_lote: idLote,
          tipo_movimiento: "TRASLADO_SALIDA",
          cantidad,
          saldo_anterior: stockOrigen,
          saldo_resultante: nuevoOrigen,
          referencia,
          observacion: observacion || "Traslado entre sucursales"
        });

    if (errorMovimientoSalida)
      throw errorMovimientoSalida;


    // REGISTRAR ENTRADA
    const { error: errorMovimientoEntrada } =
      await client
        .from("movimientos_stock")
        .insert({
          id_tienda: idDestino,
          id_lote: idLote,
          tipo_movimiento: "TRASLADO_ENTRADA",
          cantidad,
          saldo_anterior: stockDestino,
          saldo_resultante: nuevoDestino,
          referencia,
          observacion: observacion || "Traslado entre sucursales"
        });

    if (errorMovimientoEntrada)
      throw errorMovimientoEntrada;


    mostrarAlerta(
      `Traslado realizado correctamente. Referencia: ${referencia}`
    );

    formTraslado.reset();

    await consultarStockActual();

  } catch (error) {

    console.error(
      "Error realizando traslado:",
      error
    );

    mostrarAlerta(
      "No fue posible realizar el traslado: " +
      error.message,
      true
    );
  }

});

// Inicializar al cargar la página
document.addEventListener("DOMContentLoaded", cargarCatalogos);