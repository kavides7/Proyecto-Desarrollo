// ====================================================
// CREDENCIALES CONFIGURADAS DIRECTAS A TU SUPABASE
// ====================================================
const SUPABASE_URL = "https://falivfgdcqglihwkogvp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbGl2ZmdkY3FnbGlod2tvZ3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDg3NzksImV4cCI6MjEwNjE4NDc3OX0.5MFm-5lohtj5EnZEwMfthcAQUZFUUscasfJgOAoOePQ";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cache local de alertas
let cacheAlertas = [];

// Elementos del DOM
const tablaCuerpo = document.getElementById("tabla-cuerpo-vencimientos");
const filtroRiesgo = document.getElementById("filtro-riesgo");
const btnReporte = document.getElementById("btn-generar-reporte");

// ====================================================
// 1. CARGAR DATOS DE VENCIMIENTOS
// ====================================================
async function cargarVencimientos() {
  try {
    // 1. Intentar consultar directamente desde la vista SQL
    const { data: datosVista, error: errVista } = await client
      .from("vista_vencimientos")
      .select("*")
      .order("dias_restantes", { ascending: true });

    if (!errVista && datosVista) {
      cacheAlertas = datosVista;
      renderizarTablaAlertas();
      return;
    }

    // 2. Fallback: Si la vista no está creada, calcular directamente desde inventario y lotes
    console.warn("Consultando tablas base como alternativa a vista_vencimientos...");
    const { data: invData, error: errInv } = await client
      .from("inventario")
      .select(`
        stock_actual,
        tiendas ( nombre ),
        lotes (
          numero_lote,
          fecha_vencimiento,
          productos ( nombre )
        )
      `)
      .gt("stock_actual", 0);

    if (errInv) throw errInv;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    cacheAlertas = (invData || []).map(item => {
      const fechaVence = new Date(item.lotes?.fecha_vencimiento + "T00:00:00");
      const diffTiempo = fechaVence - hoy;
      const diasRestantes = Math.ceil(diffTiempo / (1000 * 60 * 60 * 24));

      return {
        sucursal: item.tiendas?.nombre || "Farmacia",
        medicamento: item.lotes?.productos?.nombre || "Medicamento",
        lote: item.lotes?.numero_lote || "N/A",
        fecha_vencimiento: item.lotes?.fecha_vencimiento || "--",
        stock: item.stock_actual,
        dias_restantes: diasRestantes
      };
    }).sort((a, b) => a.dias_restantes - b.dias_restantes);

    renderizarTablaAlertas();

  } catch (error) {
    console.error("Error al cargar vencimientos:", error);
    tablaCuerpo.innerHTML = `<tr><td colspan="7" class="texto-centro" style="color: #b91c1c;">Error al conectar con la base de datos: ${error.message}</td></tr>`;
  }
}

// ====================================================
// 2. RENDERIZAR TABLA CON SEMÁFOROS
// ====================================================
function renderizarTablaAlertas() {
  const riesgoSeleccionado = filtroRiesgo?.value || "todos";

  const filtrados = cacheAlertas.filter(item => {
    const dias = item.dias_restantes;
    if (riesgoSeleccionado === "rojo") {
      return dias <= 30; // Crítico o ya vencido
    } else if (riesgoSeleccionado === "amarillo") {
      return dias > 30 && dias <= 90; // Próximo a vencer
    }
    return true; // Todos
  });

  if (!filtrados.length) {
    tablaCuerpo.innerHTML = `<tr><td colspan="7" class="texto-centro">No hay productos en esta condición de riesgo.</td></tr>`;
    return;
  }

  tablaCuerpo.innerHTML = filtrados.map(item => {
    const dias = item.dias_restantes;
    let badge = "";

    if (dias <= 30) {
      badge = `<span class="badge-vence vence-critico">🔴 Crítico / Vencido</span>`;
    } else if (dias <= 90) {
      badge = `<span class="badge-vence vence-alerta">🟡 Próximo a vencer</span>`;
    } else {
      badge = `<span class="badge-vence vence-vigente">🟢 Vigente</span>`;
    }

    return `
      <tr>
        <td><strong>${item.sucursal}</strong></td>
        <td>${item.medicamento}</td>
        <td><code>${item.lote}</code></td>
        <td>${item.fecha_vencimiento}</td>
        <td class="texto-derecha"><strong>${dias}</strong></td>
        <td class="texto-derecha"><span class="badge-stock stock-alto">${item.stock}</span></td>
        <td class="texto-centro">${badge}</td>
      </tr>
    `;
  }).join("");
}

// ====================================================
// 3. GENERAR REPORTE AUTOMÁTICO (PDF o IMPRIMIR)
// ====================================================
btnReporte?.addEventListener("click", () => {
  if (typeof html2pdf !== "undefined") {
    const elemento = document.querySelector(".tabla-contenedor");
    const opciones = {
      margin: 10,
      filename: `Reporte_Vencimientos_FARMATODO_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'letter', orientation: 'landscape' }
    };
    html2pdf().set(opciones).from(elemento).save();
  } else {
    window.print();
  }
});

// Eventos de filtro y carga inicial
filtroRiesgo?.addEventListener("change", renderizarTablaAlertas);
document.addEventListener("DOMContentLoaded", cargarVencimientos);