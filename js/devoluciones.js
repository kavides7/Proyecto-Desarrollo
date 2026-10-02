// ====================================================
// MÓDULO 4: PROVEEDORES Y DEVOLUCIONES (Integrante 4)
// Pantalla 1: registro y listado de proveedores
// ====================================================

// 1) CONEXIÓN A SUPABASE
// Copia la anon key tal cual aparece en la línea 2 de js/app.js
const SUPABASE_URL = "https://falivfgdcqglihwkogvp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbGl2ZmdkY3FnbGlod2tvZ3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDg3NzksImV4cCI6MjEwNjE4NDc3OX0.5MFm-5lohtj5EnZEwMfthcAQUZFUUscasfJgOAoOePQ";
// Se llama "db" para no chocar con el nombre "client" que usa app.js
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2) ELEMENTOS DEL DOM
const formProveedor = document.getElementById("form-proveedor");
const tablaProveedores = document.getElementById("tabla-proveedores");
const btnGuardar = document.getElementById("btn-guardar");
const btnRefrescar = document.getElementById("btn-refrescar");
const alertaBox = document.getElementById("alerta");

// 3) FUNCIONES AUXILIARES
function avisar(mensaje, esError = false) {
  alertaBox.textContent = mensaje;
  alertaBox.className = `alerta ${esError ? "alerta-error" : "alerta-exito"}`;
  alertaBox.classList.remove("oculto");

  setTimeout(() => {
    alertaBox.classList.add("oculto");
  }, 4500);
}

// Crea una celda <td> con texto seguro (evita inyectar HTML)
function crearCelda(texto, clase = "") {
  const td = document.createElement("td");
  td.textContent = texto;
  if (clase) td.className = clase;
  return td;
}

// Si un campo de texto viene vacío, se guarda como null
function textoONulo(valor) {
  const limpio = valor.trim();
  return limpio === "" ? null : limpio;
}

// 4) LEER PROVEEDORES
async function cargarProveedores() {
  const { data, error } = await db
    .from("proveedores")
    .select("*")
    .order("nombre", { ascending: true });

  if (error) {
    console.error(error);
    avisar("No se pudieron cargar los proveedores: " + error.message, true);
    return;
  }

  tablaProveedores.innerHTML = "";

  if (data.length === 0) {
    const fila = document.createElement("tr");
    const celda = crearCelda("Todavía no hay proveedores registrados.", "texto-centro");
    celda.colSpan = 5;
    fila.appendChild(celda);
    tablaProveedores.appendChild(fila);
    return;
  }

  data.forEach((p) => {
    const fila = document.createElement("tr");
    fila.appendChild(crearCelda(p.nombre));
    fila.appendChild(crearCelda(p.contacto || "—"));
    fila.appendChild(crearCelda(p.acepta_canje ? "Sí" : "No"));
    fila.appendChild(crearCelda(p.acepta_nota_credito ? "Sí" : "No"));
    fila.appendChild(crearCelda(p.dias_min_antes_vencimiento, "texto-derecha"));
    tablaProveedores.appendChild(fila);
  });
}

// 5) GUARDAR UN PROVEEDOR NUEVO
formProveedor.addEventListener("submit", async (evento) => {
  evento.preventDefault(); // evita que la página se recargue

  const nuevo = {
    nombre: document.getElementById("prov-nombre").value.trim(),
    contacto: textoONulo(document.getElementById("prov-contacto").value),
    telefono: textoONulo(document.getElementById("prov-telefono").value),
    correo: textoONulo(document.getElementById("prov-correo").value),
    acepta_canje: document.getElementById("prov-canje").checked,
    acepta_nota_credito: document.getElementById("prov-nota").checked,
    dias_min_antes_vencimiento: parseInt(document.getElementById("prov-dias").value, 10) || 0,
    politica_devolucion: textoONulo(document.getElementById("prov-politica").value),
  };

  btnGuardar.disabled = true;
  btnGuardar.textContent = "Guardando...";

  const { error } = await db.from("proveedores").insert([nuevo]);

  btnGuardar.disabled = false;
  btnGuardar.textContent = "Guardar proveedor";

  if (error) {
    console.error(error);
    avisar("No se pudo guardar: " + error.message, true);
    return;
  }

  avisar("Proveedor guardado correctamente.");
  formProveedor.reset();
  cargarProveedores();
});

// 6) EVENTOS E INICIO
btnRefrescar.addEventListener("click", cargarProveedores);
cargarProveedores();