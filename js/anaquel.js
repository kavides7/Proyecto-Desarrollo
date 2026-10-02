// ====================================================
// MÓDULO 4: RETIRO DE ANAQUEL (Integrante 4)
// Pantalla 5: lotes con stock, ordenados por vencimiento y con
// semáforo de riesgo. Cada lote tiene un botón que abre
// "Nueva devolución" con la sucursal y el lote ya elegidos.
// ====================================================

// 1) CONEXIÓN A SUPABASE
// Copia la línea de la clave desde tu archivo js/devoluciones.js (ya la tiene bien puesta)
const SUPABASE_URL = "https://falivfgdcqglihwkogvp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbGl2ZmdkY3FnbGlod2tvZ3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDg3NzksImV4cCI6MjEwNjE4NDc3OX0.5MFm-5lohtj5EnZEwMfthcAQUZFUUscasfJgOAoOePQ";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2) UMBRALES DEL SEMÁFORO (en días)
// Rojo: vencido o con menos de DIAS_ROJO días | Amarillo: hasta DIAS_AMARILLO días | Verde: más
// Si el Integrante 3 usa otros valores en su módulo, cámbialos aquí.
const DIAS_ROJO = 90;       // 3 meses
const DIAS_AMARILLO = 180;  // 6 meses

// 3) ELEMENTOS DEL DOM
const filtroTienda = document.getElementById("filtro-tienda");
const filtroRiesgo = document.getElementById("filtro-riesgo");
const btnRefrescar = document.getElementById("btn-refrescar");
const contenedorEstadisticas = document.getElementById("estadisticas");
const tablaAnaquel = document.getElementById("tabla-anaquel");
const totalLotes = document.getElementById("total-lotes");
const alertaBox = document.getElementById("alerta");

// 4) DATOS EN MEMORIA
let inventario = []; // todos los lotes con stock, ya con sus días y su semáforo

// 5) FUNCIONES AUXILIARES
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

// Días que faltan para el vencimiento (negativo = ya venció)
function diasParaVencer(fechaTexto) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(fechaTexto + "T00:00:00");
  return Math.round((vence - hoy) / 86400000);
}

// Decide el color del semáforo según los días que faltan
function clasificar(dias) {
  if (dias < 0) return { nivel: "rojo", texto: "🔴 Vencido" };
  if (dias < DIAS_ROJO) return { nivel: "rojo", texto: "🔴 Crítico" };
  if (dias <= DIAS_AMARILLO) return { nivel: "amarillo", texto: "🟡 Próximo a vencer" };
  return { nivel: "verde", texto: "🟢 Vigente" };
}

function crearEtiquetaSemaforo(semaforo) {
  const colores = {
    rojo: { fondo: "#fee2e2", texto: "#991b1b" },
    amarillo: { fondo: "#fef3c7", texto: "#92400e" },
    verde: { fondo: "#d1fae5", texto: "#065f46" },
  };
  const color = colores[semaforo.nivel];
  const span = document.createElement("span");
  span.textContent = semaforo.texto;
  span.style.cssText =
    `background:${color.fondo}; color:${color.texto}; padding:2px 10px; ` +
    "border-radius:999px; font-size:0.8rem; font-weight:600; white-space:nowrap;";
  return span;
}

// 6) CARGAR LAS SUCURSALES DEL FILTRO
async function cargarFiltros() {
  const { data, error } = await db.from("tiendas").select("id_tienda, nombre").order("nombre");

  if (error) {
    console.error(error);
    avisar("No se pudieron cargar las sucursales.", true);
    return;
  }

  data.forEach((t) => {
    const op = document.createElement("option");
    op.value = t.id_tienda;
    op.textContent = t.nombre;
    filtroTienda.appendChild(op);
  });
}

// 7) CARGAR EL INVENTARIO CON STOCK
async function cargarInventario() {
  const { data, error } = await db
    .from("inventario")
    .select(`
      id_tienda, id_lote, stock_actual,
      tiendas(nombre),
      lotes(numero_lote, fecha_vencimiento, productos(nombre))
    `)
    .gt("stock_actual", 0);

  if (error) {
    console.error(error);
    avisar("No se pudo cargar el inventario: " + error.message, true);
    return;
  }

  inventario = data
    .map((fila) => {
      const lote = uno(fila.lotes) || {};
      const dias = lote.fecha_vencimiento ? diasParaVencer(lote.fecha_vencimiento) : 99999;
      return {
        id_tienda: fila.id_tienda,
        id_lote: fila.id_lote,
        stock: fila.stock_actual,
        sucursal: uno(fila.tiendas)?.nombre || "—",
        producto: uno(lote.productos)?.nombre || "—",
        numero_lote: lote.numero_lote || "—",
        vence: lote.fecha_vencimiento || "—",
        dias: dias,
        semaforo: clasificar(dias),
      };
    })
    .sort((a, b) => a.dias - b.dias); // primero los que vencen antes

  mostrar();
}

// 8) MOSTRAR TARJETAS Y TABLA SEGÚN LOS FILTROS
function crearTarjetaEstadistica(titulo, valor) {
  const caja = document.createElement("div");
  caja.style.cssText = "background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:1rem;";

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

function mostrar() {
  // Las tarjetas respetan la sucursal elegida, pero no el nivel de riesgo
  const deLaSucursal = inventario.filter(
    (i) => !filtroTienda.value || String(i.id_tienda) === filtroTienda.value
  );

  const rojos = deLaSucursal.filter((i) => i.semaforo.nivel === "rojo");
  const amarillos = deLaSucursal.filter((i) => i.semaforo.nivel === "amarillo");
  const verdes = deLaSucursal.filter((i) => i.semaforo.nivel === "verde");
  const unidadesEnRiesgo = [...rojos, ...amarillos].reduce((suma, i) => suma + i.stock, 0);

  contenedorEstadisticas.innerHTML = "";
  [
    ["🔴 Lotes en rojo", rojos.length],
    ["🟡 Lotes en amarillo", amarillos.length],
    ["🟢 Lotes en verde", verdes.length],
    ["Unidades en riesgo", unidadesEnRiesgo],
  ].forEach(([titulo, valor]) => {
    contenedorEstadisticas.appendChild(crearTarjetaEstadistica(titulo, valor));
  });

  // La tabla aplica además el filtro de riesgo
  const riesgo = filtroRiesgo.value;
  const filas = deLaSucursal.filter((i) => {
    if (!riesgo) return true;
    if (riesgo === "riesgo") return i.semaforo.nivel !== "verde";
    return i.semaforo.nivel === riesgo;
  });

  totalLotes.textContent = `${filas.length} lote(s)`;
  tablaAnaquel.innerHTML = "";

  if (filas.length === 0) {
    const fila = document.createElement("tr");
    const celda = crearCelda("No hay lotes con stock para estos filtros.", "texto-centro");
    celda.colSpan = 8;
    fila.appendChild(celda);
    tablaAnaquel.appendChild(fila);
    return;
  }

  filas.forEach((i) => {
    const fila = document.createElement("tr");
    fila.appendChild(crearCelda(i.sucursal));
    fila.appendChild(crearCelda(i.producto));
    fila.appendChild(crearCelda(i.numero_lote));
    fila.appendChild(crearCelda(i.vence));
    fila.appendChild(crearCelda(i.dias < 0 ? "Vencido" : i.dias, "texto-derecha"));

    const celdaSemaforo = document.createElement("td");
    celdaSemaforo.appendChild(crearEtiquetaSemaforo(i.semaforo));
    fila.appendChild(celdaSemaforo);

    fila.appendChild(crearCelda(i.stock, "texto-derecha"));

    // Botón que abre "Nueva devolución" con la sucursal y el lote ya elegidos
    const celdaAccion = document.createElement("td");
    const enlace = document.createElement("a");
    enlace.href = `nueva-devolucion.html?tienda=${i.id_tienda}&lote=${i.id_lote}&cantidad=${i.stock}`;
    enlace.className = i.semaforo.nivel === "verde" ? "btn btn-secundario" : "btn btn-primario";
    enlace.style.textDecoration = "none";
    enlace.textContent = "Retirar ➜";
    celdaAccion.appendChild(enlace);
    fila.appendChild(celdaAccion);

    tablaAnaquel.appendChild(fila);
  });
}

// 9) EVENTOS E INICIO
filtroTienda.addEventListener("change", mostrar);
filtroRiesgo.addEventListener("change", mostrar);
btnRefrescar.addEventListener("click", cargarInventario);

cargarFiltros();
cargarInventario();