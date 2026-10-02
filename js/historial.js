// ====================================================
// MÓDULO 4: HISTORIAL DE LIQUIDACIONES (Integrante 4)
// Pantalla 4: totales, resúmenes por proveedor y sucursal,
// detalle de liquidaciones y bitácora de cambios de estado
// ====================================================

// 1) CONEXIÓN A SUPABASE
// Copia la línea de la clave desde tu archivo js/devoluciones.js (ya la tiene bien puesta)
const SUPABASE_URL = "https://falivfgdcqglihwkogvp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbGl2ZmdkY3FnbGlod2tvZ3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDg3NzksImV4cCI6MjEwNjE4NDc3OX0.5MFm-5lohtj5EnZEwMfthcAQUZFUUscasfJgOAoOePQ";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2) ELEMENTOS DEL DOM
const filtroTienda = document.getElementById("filtro-tienda");
const filtroProveedor = document.getElementById("filtro-proveedor");
const filtroEstado = document.getElementById("filtro-estado");
const fechaDesde = document.getElementById("fecha-desde");
const fechaHasta = document.getElementById("fecha-hasta");
const btnLimpiar = document.getElementById("btn-limpiar");
const btnImprimir = document.getElementById("btn-imprimir");

const contenedorEstadisticas = document.getElementById("estadisticas");
const tablaProveedores = document.getElementById("tabla-proveedores");
const tablaSucursales = document.getElementById("tabla-sucursales");
const tablaLiquidaciones = document.getElementById("tabla-liquidaciones");
const totalLiquidaciones = document.getElementById("total-liquidaciones");
const tablaBitacora = document.getElementById("tabla-bitacora");
const totalBitacora = document.getElementById("total-bitacora");
const alertaBox = document.getElementById("alerta");

// 3) FUNCIONES AUXILIARES
function avisar(mensaje, esError = false) {
  alertaBox.textContent = mensaje;
  alertaBox.className = `alerta ${esError ? "alerta-error" : "alerta-exito"}`;
  alertaBox.classList.remove("oculto");
  setTimeout(() => alertaBox.classList.add("oculto"), 4500);
}

function crearCelda(texto, clase = "") {
  const td = document.createElement("td");
  td.textContent = texto;
  if (clase) td.className = clase;
  return td;
}

// Si Supabase devuelve un objeto o una lista de un elemento, siempre devuelve el objeto
function uno(valor) {
  return Array.isArray(valor) ? valor[0] : valor;
}

function formatoQ(numero) {
  return "Q " + Number(numero || 0).toFixed(2);
}

// Las fechas con hora se guardan en hora UTC; se convierten a la hora local
function formatoFechaHora(texto) {
  if (!texto) return "—";
  const tieneZona = /Z$|[+-]\d\d:?\d\d$/.test(texto);
  return new Date(tieneZona ? texto : texto + "Z").toLocaleString("es-GT");
}

// Etiqueta de color según el estado
function crearEtiquetaEstado(estado) {
  const colores = {
    "En revisión": { fondo: "#fef3c7", texto: "#92400e" },
    "Aceptado": { fondo: "#d1fae5", texto: "#065f46" },
    "Rechazado": { fondo: "#fee2e2", texto: "#991b1b" },
  };
  const color = colores[estado] || { fondo: "#e5e7eb", texto: "#374151" };
  const span = document.createElement("span");
  span.textContent = estado;
  span.style.cssText =
    `background:${color.fondo}; color:${color.texto}; padding:2px 10px; ` +
    "border-radius:999px; font-size:0.8rem; font-weight:600; white-space:nowrap;";
  return span;
}

// Agrega una fila de una sola celda con un mensaje (por ejemplo "Sin datos")
function filaMensaje(cuerpo, columnas, mensaje) {
  const fila = document.createElement("tr");
  const celda = crearCelda(mensaje, "texto-centro");
  celda.colSpan = columnas;
  fila.appendChild(celda);
  cuerpo.appendChild(fila);
}

// 4) CARGAR LOS FILTROS (sucursales y proveedores)
async function cargarFiltros() {
  const [rTiendas, rProv] = await Promise.all([
    db.from("tiendas").select("id_tienda, nombre").order("nombre"),
    db.from("proveedores").select("id_proveedor, nombre").order("nombre"),
  ]);

  if (rTiendas.error || rProv.error) {
    console.error(rTiendas.error, rProv.error);
    avisar("No se pudieron cargar los filtros. Revisa la consola (F12).", true);
    return;
  }

  rTiendas.data.forEach((t) => {
    const op = document.createElement("option");
    op.value = t.id_tienda;
    op.textContent = t.nombre;
    filtroTienda.appendChild(op);
  });

  rProv.data.forEach((p) => {
    const op = document.createElement("option");
    op.value = p.id_proveedor;
    op.textContent = p.nombre;
    filtroProveedor.appendChild(op);
  });
}

// 5) CONSULTAR DEVOLUCIONES SEGÚN LOS FILTROS Y MOSTRAR TODO
async function cargarTodo() {
  let consulta = db
    .from("devoluciones")
    .select(`
      id_devolucion, fecha_retiro, fecha_resolucion, estado, resultado,
      monto_liquidado, numero_documento, id_tienda, id_proveedor,
      tiendas(nombre), proveedores(nombre)
    `)
    .order("id_devolucion", { ascending: false });

  if (filtroTienda.value) consulta = consulta.eq("id_tienda", filtroTienda.value);
  if (filtroProveedor.value) consulta = consulta.eq("id_proveedor", filtroProveedor.value);
  if (filtroEstado.value) consulta = consulta.eq("estado", filtroEstado.value);
  if (fechaDesde.value) consulta = consulta.gte("fecha_retiro", fechaDesde.value);
  if (fechaHasta.value) consulta = consulta.lte("fecha_retiro", fechaHasta.value);

  const { data, error } = await consulta;

  if (error) {
    console.error(error);
    avisar("No se pudo cargar el historial: " + error.message, true);
    return;
  }

  mostrarEstadisticas(data);
  mostrarResumen(tablaProveedores, resumirPor(data, (d) => uno(d.proveedores)?.nombre || "—"));
  mostrarResumen(tablaSucursales, resumirPor(data, (d) => uno(d.tiendas)?.nombre || "—"));
  mostrarLiquidaciones(data);
  await mostrarBitacora(data);
}

// 6) TARJETAS DE TOTALES
function crearTarjetaEstadistica(titulo, valor) {
  const caja = document.createElement("div");
  caja.style.cssText =
    "background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:1rem;";

  const etiqueta = document.createElement("div");
  etiqueta.textContent = titulo;
  etiqueta.style.cssText = "font-size:0.8rem; color:#6b7280;";

  const numero = document.createElement("div");
  numero.textContent = valor;
  numero.style.cssText = "font-size:1.5rem; font-weight:700; margin-top:0.25rem;";

  caja.appendChild(etiqueta);
  caja.appendChild(numero);
  return caja;
}

function mostrarEstadisticas(lista) {
  const aceptadas = lista.filter((d) => d.estado === "Aceptado");
  const totalLiquidado = aceptadas.reduce((suma, d) => suma + Number(d.monto_liquidado || 0), 0);

  const datos = [
    ["Total liquidado", formatoQ(totalLiquidado)],
    ["Devoluciones", lista.length],
    ["Aceptadas", aceptadas.length],
    ["Rechazadas", lista.filter((d) => d.estado === "Rechazado").length],
    ["En revisión", lista.filter((d) => d.estado === "En revisión").length],
    ["Canjes", aceptadas.filter((d) => d.resultado === "Canje").length],
    ["Notas de crédito", aceptadas.filter((d) => d.resultado === "Nota de crédito").length],
  ];

  contenedorEstadisticas.innerHTML = "";
  datos.forEach(([titulo, valor]) => {
    contenedorEstadisticas.appendChild(crearTarjetaEstadistica(titulo, valor));
  });
}

// 7) RESÚMENES POR PROVEEDOR Y POR SUCURSAL
function resumirPor(lista, obtenerNombre) {
  const mapa = new Map();

  lista.forEach((d) => {
    const nombre = obtenerNombre(d);
    if (!mapa.has(nombre)) {
      mapa.set(nombre, { nombre, total: 0, aceptadas: 0, rechazadas: 0, revision: 0, monto: 0 });
    }
    const fila = mapa.get(nombre);
    fila.total++;
    if (d.estado === "Aceptado") {
      fila.aceptadas++;
      fila.monto += Number(d.monto_liquidado || 0);
    } else if (d.estado === "Rechazado") {
      fila.rechazadas++;
    } else {
      fila.revision++;
    }
  });

  // Primero los que más dinero liquidaron
  return [...mapa.values()].sort(
    (a, b) => b.monto - a.monto || a.nombre.localeCompare(b.nombre)
  );
}

function mostrarResumen(cuerpo, filas) {
  cuerpo.innerHTML = "";

  if (filas.length === 0) {
    filaMensaje(cuerpo, 6, "Sin datos para estos filtros.");
    return;
  }

  filas.forEach((r) => {
    const fila = document.createElement("tr");
    fila.appendChild(crearCelda(r.nombre));
    fila.appendChild(crearCelda(r.total, "texto-derecha"));
    fila.appendChild(crearCelda(r.aceptadas, "texto-derecha"));
    fila.appendChild(crearCelda(r.rechazadas, "texto-derecha"));
    fila.appendChild(crearCelda(r.revision, "texto-derecha"));
    fila.appendChild(crearCelda(formatoQ(r.monto), "texto-derecha"));
    cuerpo.appendChild(fila);
  });
}

// 8) DETALLE DE LIQUIDACIONES
function mostrarLiquidaciones(lista) {
  totalLiquidaciones.textContent = `${lista.length} devolución(es)`;
  tablaLiquidaciones.innerHTML = "";

  if (lista.length === 0) {
    filaMensaje(tablaLiquidaciones, 9, "No hay devoluciones con esos filtros.");
    return;
  }

  lista.forEach((d) => {
    const fila = document.createElement("tr");
    fila.appendChild(crearCelda("#" + d.id_devolucion));
    fila.appendChild(crearCelda(d.fecha_retiro));
    fila.appendChild(crearCelda(d.fecha_resolucion || "—"));
    fila.appendChild(crearCelda(uno(d.tiendas)?.nombre || "—"));
    fila.appendChild(crearCelda(uno(d.proveedores)?.nombre || "—"));

    const celdaEstado = document.createElement("td");
    celdaEstado.appendChild(crearEtiquetaEstado(d.estado));
    fila.appendChild(celdaEstado);

    fila.appendChild(crearCelda(d.resultado || "—"));
    fila.appendChild(crearCelda(d.numero_documento || "—"));
    fila.appendChild(crearCelda(d.estado === "Aceptado" ? formatoQ(d.monto_liquidado) : "—", "texto-derecha"));
    tablaLiquidaciones.appendChild(fila);
  });
}

// 9) BITÁCORA DE CAMBIOS DE ESTADO (auditoría)
async function mostrarBitacora(devoluciones) {
  tablaBitacora.innerHTML = "";

  if (devoluciones.length === 0) {
    totalBitacora.textContent = "0 cambio(s)";
    filaMensaje(tablaBitacora, 7, "No hay cambios para estos filtros.");
    return;
  }

  // Solo se muestran los cambios de las devoluciones que pasaron los filtros
  const mapa = new Map(devoluciones.map((d) => [d.id_devolucion, d]));
  const ids = devoluciones.map((d) => d.id_devolucion);

  const { data, error } = await db
    .from("historial_liquidaciones")
    .select("id_historial, id_devolucion, estado_anterior, estado_nuevo, comentario, fecha_cambio")
    .in("id_devolucion", ids)
    .order("fecha_cambio", { ascending: false })
    .order("id_historial", { ascending: false });

  if (error) {
    console.error(error);
    avisar("No se pudo cargar la bitácora: " + error.message, true);
    return;
  }

  totalBitacora.textContent = `${data.length} cambio(s)`;

  if (data.length === 0) {
    filaMensaje(tablaBitacora, 7, "Todavía no hay cambios registrados.");
    return;
  }

  data.forEach((h) => {
    const d = mapa.get(h.id_devolucion);
    const fila = document.createElement("tr");
    fila.appendChild(crearCelda(formatoFechaHora(h.fecha_cambio)));
    fila.appendChild(crearCelda("#" + h.id_devolucion));
    fila.appendChild(crearCelda(d ? uno(d.tiendas)?.nombre || "—" : "—"));
    fila.appendChild(crearCelda(d ? uno(d.proveedores)?.nombre || "—" : "—"));
    fila.appendChild(crearCelda(h.estado_anterior || "—"));
    fila.appendChild(crearCelda(h.estado_nuevo));
    fila.appendChild(crearCelda(h.comentario || "—"));
    tablaBitacora.appendChild(fila);
  });
}

// 10) EVENTOS E INICIO
[filtroTienda, filtroProveedor, filtroEstado, fechaDesde, fechaHasta].forEach((control) => {
  control.addEventListener("change", cargarTodo);
});

btnLimpiar.addEventListener("click", () => {
  filtroTienda.value = "";
  filtroProveedor.value = "";
  filtroEstado.value = "";
  fechaDesde.value = "";
  fechaHasta.value = "";
  cargarTodo();
});

btnImprimir.addEventListener("click", () => window.print());

cargarFiltros();
cargarTodo();