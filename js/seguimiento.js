// ====================================================
// MÓDULO 4: SEGUIMIENTO DE DEVOLUCIONES (Integrante 4)
// Pantalla 3: ver devoluciones, su detalle e historial,
// y resolver el trámite (Aceptado / Rechazado)
// ====================================================

// 1) CONEXIÓN A SUPABASE
// Copia la línea de la clave desde tu archivo js/devoluciones.js (ya la tiene bien puesta)
const SUPABASE_URL = "https://falivfgdcqglihwkogvp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbGl2ZmdkY3FnbGlod2tvZ3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDg3NzksImV4cCI6MjEwNjE4NDc3OX0.5MFm-5lohtj5EnZEwMfthcAQUZFUUscasfJgOAoOePQ";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2) ELEMENTOS DEL DOM
const filtroEstado = document.getElementById("filtro-estado");
const filtroTienda = document.getElementById("filtro-tienda");
const filtroProveedor = document.getElementById("filtro-proveedor");
const btnRefrescar = document.getElementById("btn-refrescar");
const totalDevoluciones = document.getElementById("total-devoluciones");
const tablaDevoluciones = document.getElementById("tabla-devoluciones");

const detalleVacio = document.getElementById("detalle-vacio");
const detalleContenido = document.getElementById("detalle-contenido");
const detalleResumen = document.getElementById("detalle-resumen");
const tablaDetalle = document.getElementById("tabla-detalle");
const detalleTotal = document.getElementById("detalle-total");
const tablaHistorial = document.getElementById("tabla-historial");

const bloqueGestion = document.getElementById("bloque-gestion");
const infoPolitica = document.getElementById("info-politica");
const formGestion = document.getElementById("form-gestion");
const selectAccion = document.getElementById("accion");
const grupoAceptado = document.getElementById("grupo-aceptado");
const selectResultado = document.getElementById("resultado");
const inputMonto = document.getElementById("monto");
const inputDocumento = document.getElementById("documento");
const inputComentario = document.getElementById("comentario");
const btnGuardar = document.getElementById("btn-guardar");
const alertaBox = document.getElementById("alerta");

// 3) DATOS EN MEMORIA
let listaDevoluciones = [];   // devoluciones que se muestran en la tabla
let actual = null;            // devolución seleccionada
let totalEstimado = 0;        // suma de cantidad x costo de la devolución seleccionada

// 4) FUNCIONES AUXILIARES
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

// Agrega una línea "Etiqueta: valor" al resumen (con texto seguro)
function agregarLineaResumen(etiqueta, valor) {
  const p = document.createElement("p");
  p.style.margin = "0.25rem 0";
  const fuerte = document.createElement("strong");
  fuerte.textContent = etiqueta + ": ";
  p.appendChild(fuerte);
  if (valor instanceof Node) {
    p.appendChild(valor);
  } else {
    p.appendChild(document.createTextNode(valor));
  }
  detalleResumen.appendChild(p);
}

// 5) CARGAR FILTROS (sucursales y proveedores)
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

// 6) CARGAR Y MOSTRAR LA LISTA DE DEVOLUCIONES
async function cargarLista() {
  let consulta = db
    .from("devoluciones")
    .select(`
      id_devolucion, fecha_retiro, estado, resultado, monto_liquidado,
      numero_documento, fecha_resolucion, observaciones, id_tienda, id_proveedor,
      tiendas(nombre),
      proveedores(nombre, acepta_canje, acepta_nota_credito, dias_min_antes_vencimiento)
    `)
    .order("id_devolucion", { ascending: false });

  if (filtroEstado.value) consulta = consulta.eq("estado", filtroEstado.value);
  if (filtroTienda.value) consulta = consulta.eq("id_tienda", filtroTienda.value);
  if (filtroProveedor.value) consulta = consulta.eq("id_proveedor", filtroProveedor.value);

  const { data, error } = await consulta;

  if (error) {
    console.error(error);
    avisar("No se pudieron cargar las devoluciones: " + error.message, true);
    return;
  }

  listaDevoluciones = data;
  totalDevoluciones.textContent = `${data.length} devolución(es)`;
  tablaDevoluciones.innerHTML = "";

  if (data.length === 0) {
    const fila = document.createElement("tr");
    const celda = crearCelda("No hay devoluciones con esos filtros.", "texto-centro");
    celda.colSpan = 8;
    fila.appendChild(celda);
    tablaDevoluciones.appendChild(fila);
    return;
  }

  data.forEach((d) => {
    const fila = document.createElement("tr");
    if (actual && actual.id_devolucion === d.id_devolucion) {
      fila.style.background = "#f0fdf4"; // resalta la fila seleccionada
    }

    fila.appendChild(crearCelda("#" + d.id_devolucion));
    fila.appendChild(crearCelda(d.fecha_retiro));
    fila.appendChild(crearCelda(uno(d.tiendas)?.nombre || "—"));
    fila.appendChild(crearCelda(uno(d.proveedores)?.nombre || "—"));

    const celdaEstado = document.createElement("td");
    celdaEstado.appendChild(crearEtiquetaEstado(d.estado));
    fila.appendChild(celdaEstado);

    fila.appendChild(crearCelda(d.resultado || "—"));
    fila.appendChild(crearCelda(d.estado === "Aceptado" ? formatoQ(d.monto_liquidado) : "—", "texto-derecha"));

    const celdaBoton = document.createElement("td");
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn btn-secundario";
    boton.textContent = d.estado === "En revisión" ? "Gestionar" : "Ver";
    boton.addEventListener("click", () => seleccionar(d.id_devolucion));
    celdaBoton.appendChild(boton);
    fila.appendChild(celdaBoton);

    tablaDevoluciones.appendChild(fila);
  });
}

// 7) SELECCIONAR UNA DEVOLUCIÓN Y MOSTRAR SU DETALLE
async function seleccionar(idDevolucion) {
  const d = listaDevoluciones.find((x) => x.id_devolucion === idDevolucion);
  if (!d) return;
  actual = d;

  const [rLineas, rHistorial] = await Promise.all([
    db.from("devolucion_detalle")
      .select("cantidad, costo_unitario, motivo, lotes(numero_lote, fecha_vencimiento, productos(nombre))")
      .eq("id_devolucion", idDevolucion),
    db.from("historial_liquidaciones")
      .select("estado_anterior, estado_nuevo, comentario, fecha_cambio")
      .eq("id_devolucion", idDevolucion)
      .order("fecha_cambio", { ascending: true })
      .order("id_historial", { ascending: true }),
  ]);

  if (rLineas.error || rHistorial.error) {
    console.error(rLineas.error, rHistorial.error);
    avisar("No se pudo cargar el detalle de la devolución.", true);
    return;
  }

  mostrarDetalle(d, rLineas.data, rHistorial.data);
  cargarLista(); // vuelve a pintar la lista para resaltar la fila elegida
}

function mostrarDetalle(d, lineas, historial) {
  detalleVacio.style.display = "none";
  detalleContenido.style.display = "block";

  const prov = uno(d.proveedores) || {};

  // Resumen
  detalleResumen.innerHTML = "";
  agregarLineaResumen("Devolución", "#" + d.id_devolucion);
  agregarLineaResumen("Sucursal", uno(d.tiendas)?.nombre || "—");
  agregarLineaResumen("Proveedor", prov.nombre || "—");
  agregarLineaResumen("Fecha de retiro", d.fecha_retiro);
  agregarLineaResumen("Estado", crearEtiquetaEstado(d.estado));
  if (d.estado !== "En revisión") {
    agregarLineaResumen("Fecha de resolución", d.fecha_resolucion || "—");
  }
  if (d.estado === "Aceptado") {
    agregarLineaResumen("Resultado", d.resultado || "—");
    agregarLineaResumen("Monto liquidado", formatoQ(d.monto_liquidado));
    agregarLineaResumen("No. de documento", d.numero_documento || "—");
  }
  if (d.observaciones) {
    const pre = document.createElement("span");
    pre.style.whiteSpace = "pre-line";
    pre.textContent = d.observaciones;
    agregarLineaResumen("Observaciones", pre);
  }

  // Lotes devueltos
  tablaDetalle.innerHTML = "";
  totalEstimado = 0;
  lineas.forEach((l) => {
    const lote = uno(l.lotes) || {};
    const producto = uno(lote.productos)?.nombre || "—";
    const subtotal = l.cantidad * Number(l.costo_unitario || 0);
    totalEstimado += subtotal;

    const fila = document.createElement("tr");
    fila.appendChild(crearCelda(`${producto} (${lote.numero_lote || "?"})`));
    fila.appendChild(crearCelda(lote.fecha_vencimiento || "—"));
    fila.appendChild(crearCelda(l.cantidad, "texto-derecha"));
    fila.appendChild(crearCelda(l.motivo));
    fila.appendChild(crearCelda(formatoQ(l.costo_unitario), "texto-derecha"));
    fila.appendChild(crearCelda(formatoQ(subtotal), "texto-derecha"));
    tablaDetalle.appendChild(fila);
  });
  detalleTotal.textContent = "Valor estimado de la devolución: " + formatoQ(totalEstimado);

  // Historial
  tablaHistorial.innerHTML = "";
  if (historial.length === 0) {
    const fila = document.createElement("tr");
    const celda = crearCelda("Sin movimientos registrados.", "texto-centro");
    celda.colSpan = 4;
    fila.appendChild(celda);
    tablaHistorial.appendChild(fila);
  } else {
    historial.forEach((h) => {
      const fila = document.createElement("tr");
      fila.appendChild(crearCelda(formatoFechaHora(h.fecha_cambio)));
      fila.appendChild(crearCelda(h.estado_anterior || "—"));
      fila.appendChild(crearCelda(h.estado_nuevo));
      fila.appendChild(crearCelda(h.comentario || "—"));
      tablaHistorial.appendChild(fila);
    });
  }

  // Formulario de resolución: solo si sigue "En revisión"
  if (d.estado === "En revisión") {
    prepararFormulario(prov);
    bloqueGestion.style.display = "block";
  } else {
    bloqueGestion.style.display = "none";
  }
}

// 8) FORMULARIO DE RESOLUCIÓN
function prepararFormulario(prov) {
  formGestion.reset();
  grupoAceptado.style.display = "none";

  // Solo se ofrecen los resultados que el proveedor acepta según su política
  selectResultado.innerHTML = "";
  const opcionVacia = document.createElement("option");
  opcionVacia.value = "";
  opcionVacia.textContent = "-- Elige el resultado --";
  selectResultado.appendChild(opcionVacia);

  if (prov.acepta_canje) {
    const op = document.createElement("option");
    op.value = "Canje";
    op.textContent = "Canje de producto";
    selectResultado.appendChild(op);
  }
  if (prov.acepta_nota_credito) {
    const op = document.createElement("option");
    op.value = "Nota de crédito";
    op.textContent = "Nota de crédito / liquidación";
    selectResultado.appendChild(op);
  }

  const acepta = [];
  if (prov.acepta_canje) acepta.push("canje");
  if (prov.acepta_nota_credito) acepta.push("nota de crédito");
  infoPolitica.textContent = acepta.length
    ? `Política del proveedor: acepta ${acepta.join(" y ")}.`
    : "Este proveedor no acepta canje ni nota de crédito: solo puedes rechazar el trámite.";

  inputMonto.value = totalEstimado.toFixed(2); // sugerencia: el valor estimado
}

selectAccion.addEventListener("change", () => {
  grupoAceptado.style.display = selectAccion.value === "Aceptado" ? "block" : "none";
});

formGestion.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  if (!actual || actual.estado !== "En revisión") {
    avisar("Esta devolución ya no está en revisión.", true);
    return;
  }

  const accion = selectAccion.value;
  const comentario = inputComentario.value.trim();
  const hoy = new Date().toLocaleDateString("en-CA"); // formato AAAA-MM-DD en hora local

  if (!accion) return avisar("Elige si el proveedor aceptó o rechazó.", true);

  const cambios = { estado: accion, fecha_resolucion: hoy };

  if (accion === "Aceptado") {
    const resultado = selectResultado.value;
    const documento = inputDocumento.value.trim();
    let monto = parseFloat(inputMonto.value);

    if (!resultado) return avisar("Elige el resultado: canje o nota de crédito.", true);

    if (resultado === "Nota de crédito") {
      if (!(monto > 0)) return avisar("Para una nota de crédito el monto debe ser mayor que 0.", true);
      if (!documento) return avisar("Escribe el número de la nota de crédito.", true);
    }
    if (isNaN(monto) || monto < 0) monto = 0; // en un canje el monto puede quedar en 0

    cambios.resultado = resultado;
    cambios.monto_liquidado = monto;
    cambios.numero_documento = documento === "" ? null : documento;
  } else {
    if (!comentario) return avisar("Escribe el motivo del rechazo en el comentario.", true);
    cambios.resultado = null;
    cambios.monto_liquidado = 0;
    cambios.numero_documento = null;
  }

  if (comentario) {
    const anterior = actual.observaciones ? actual.observaciones + "\n" : "";
    cambios.observaciones = `${anterior}[${hoy}] ${comentario}`;
  }

  btnGuardar.disabled = true;
  btnGuardar.textContent = "Guardando...";

  // El filtro .eq("estado", "En revisión") evita resolver dos veces el mismo trámite
  const { data, error } = await db
    .from("devoluciones")
    .update(cambios)
    .eq("id_devolucion", actual.id_devolucion)
    .eq("estado", "En revisión")
    .select("id_devolucion");

  btnGuardar.disabled = false;
  btnGuardar.textContent = "Guardar resolución";

  if (error) {
    console.error(error);
    avisar("No se pudo guardar: " + error.message, true);
    return;
  }

  if (!data || data.length === 0) {
    avisar("Otra persona ya resolvió este trámite. Se actualizó la lista.", true);
    await cargarLista();
    return;
  }

  const idGuardado = actual.id_devolucion;
  avisar(`Devolución #${idGuardado} marcada como "${accion}".`);
  await cargarLista();
  await seleccionar(idGuardado);
});

// 9) EVENTOS E INICIO
filtroEstado.addEventListener("change", cargarLista);
filtroTienda.addEventListener("change", cargarLista);
filtroProveedor.addEventListener("change", cargarLista);
btnRefrescar.addEventListener("click", cargarLista);

cargarFiltros();
cargarLista();