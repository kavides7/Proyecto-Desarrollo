// ====================================================
// MÓDULO 4: NUEVA DEVOLUCIÓN A PROVEEDOR (Integrante 4)
// Pantalla 2: crear una devolución con uno o varios lotes
// ====================================================

// 1) CONEXIÓN A SUPABASE
// Copia estas DOS líneas desde tu archivo js/devoluciones.js (ya tiene la key bien puesta)
const SUPABASE_URL = "https://falivfgdcqglihwkogvp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbGl2ZmdkY3FnbGlod2tvZ3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDg3NzksImV4cCI6MjEwNjE4NDc3OX0.5MFm-5lohtj5EnZEwMfthcAQUZFUUscasfJgOAoOePQ";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2) ELEMENTOS DEL DOM
const selectTienda = document.getElementById("select-tienda");
const selectProveedor = document.getElementById("select-proveedor");
const selectUsuario = document.getElementById("select-usuario");
const infoProveedor = document.getElementById("info-proveedor");
const inputObservaciones = document.getElementById("observaciones");

const formLinea = document.getElementById("form-linea");
const selectLote = document.getElementById("select-lote");
const inputCantidad = document.getElementById("cantidad");
const selectMotivo = document.getElementById("motivo");
const inputCosto = document.getElementById("costo");

const tablaLineas = document.getElementById("tabla-lineas");
const btnRegistrar = document.getElementById("btn-registrar");
const alertaBox = document.getElementById("alerta");

// 3) DATOS EN MEMORIA
let proveedores = [];        // lista de proveedores activos
let inventarioTienda = [];   // lotes con stock en la tienda elegida
let lineas = [];             // lotes que el usuario va agregando a la devolución

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

// Días que faltan para el vencimiento (negativo = ya venció)
function diasParaVencer(fechaTexto) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(fechaTexto + "T00:00:00");
  return Math.round((vence - hoy) / 86400000);
}

function proveedorSeleccionado() {
  const id = parseInt(selectProveedor.value, 10);
  return proveedores.find((p) => p.id_proveedor === id) || null;
}

// 5) CARGAR CATÁLOGOS (tiendas, proveedores, usuarios)
async function cargarCatalogos() {
  const [rTiendas, rProv, rUsuarios] = await Promise.all([
    db.from("tiendas").select("id_tienda, nombre").order("nombre"),
    db.from("proveedores")
      .select("id_proveedor, nombre, acepta_canje, acepta_nota_credito, dias_min_antes_vencimiento")
      .eq("activo", true)
      .order("nombre"),
    db.from("usuarios").select("id_usuario, nombre_completo").eq("activo", true).order("nombre_completo"),
  ]);

  if (rTiendas.error || rProv.error) {
    console.error(rTiendas.error, rProv.error);
    avisar("No se pudieron cargar los catálogos. Revisa la consola (F12).", true);
    return;
  }

  // Tiendas
  selectTienda.innerHTML = '<option value="">-- Elige una sucursal --</option>';
  rTiendas.data.forEach((t) => {
    const op = document.createElement("option");
    op.value = t.id_tienda;
    op.textContent = t.nombre;
    selectTienda.appendChild(op);
  });

  // Proveedores
  proveedores = rProv.data;
  selectProveedor.innerHTML = '<option value="">-- Elige un proveedor --</option>';
  proveedores.forEach((p) => {
    const op = document.createElement("option");
    op.value = p.id_proveedor;
    op.textContent = p.nombre;
    selectProveedor.appendChild(op);
  });

  // Usuarios (opcional: si falla, simplemente queda "Sin asignar")
  if (!rUsuarios.error && rUsuarios.data) {
    rUsuarios.data.forEach((u) => {
      const op = document.createElement("option");
      op.value = u.id_usuario;
      op.textContent = u.nombre_completo;
      selectUsuario.appendChild(op);
    });
  }
}

// 6) CARGAR LOS LOTES CON STOCK DE LA TIENDA ELEGIDA
async function cargarLotesDeTienda(idTienda) {
  inventarioTienda = [];

  if (!idTienda) {
    selectLote.innerHTML = '<option value="">Primero elige una sucursal</option>';
    return;
  }

  selectLote.innerHTML = '<option value="">Cargando lotes...</option>';

  const { data, error } = await db
    .from("inventario")
    .select("id_lote, stock_actual, lotes(numero_lote, fecha_vencimiento, productos(nombre))")
    .eq("id_tienda", idTienda)
    .gt("stock_actual", 0);

  if (error) {
    console.error(error);
    selectLote.innerHTML = '<option value="">Error al cargar lotes</option>';
    avisar("No se pudieron cargar los lotes: " + error.message, true);
    return;
  }

  inventarioTienda = data
    .map((fila) => {
      const lote = Array.isArray(fila.lotes) ? fila.lotes[0] : fila.lotes;
      const producto = lote && (Array.isArray(lote.productos) ? lote.productos[0] : lote.productos);
      return {
        id_lote: fila.id_lote,
        stock: fila.stock_actual,
        numero_lote: lote ? lote.numero_lote : "?",
        vence: lote ? lote.fecha_vencimiento : null,
        producto: producto ? producto.nombre : "Producto desconocido",
        dias: lote ? diasParaVencer(lote.fecha_vencimiento) : 0,
      };
    })
    .sort((a, b) => a.dias - b.dias); // primero los que vencen antes

  if (inventarioTienda.length === 0) {
    selectLote.innerHTML = '<option value="">Esta sucursal no tiene lotes con stock</option>';
    return;
  }

  selectLote.innerHTML = '<option value="">-- Elige un lote --</option>';
  inventarioTienda.forEach((i) => {
    const op = document.createElement("option");
    op.value = i.id_lote;
    const estadoDias = i.dias < 0 ? "VENCIDO" : `vence en ${i.dias} días`;
    op.textContent = `${i.producto} | ${i.numero_lote} | ${estadoDias} | stock ${i.stock}`;
    selectLote.appendChild(op);
  });
}

// 7) MOSTRAR LA LISTA DE LOTES AGREGADOS
function renderLineas() {
  tablaLineas.innerHTML = "";

  if (lineas.length === 0) {
    const fila = document.createElement("tr");
    const celda = crearCelda("Todavía no has agregado lotes.", "texto-centro");
    celda.colSpan = 7;
    fila.appendChild(celda);
    tablaLineas.appendChild(fila);
    return;
  }

  const prov = proveedorSeleccionado();

  lineas.forEach((l, indice) => {
    let aviso = "";
    if (l.dias < 0) {
      aviso = "Lote vencido";
    } else if (prov && l.dias < prov.dias_min_antes_vencimiento) {
      aviso = `⚠ El proveedor pide mín. ${prov.dias_min_antes_vencimiento} días`;
    }

    const fila = document.createElement("tr");
    fila.appendChild(crearCelda(`${l.producto} (${l.numero_lote})`));
    fila.appendChild(crearCelda(l.vence));
    fila.appendChild(crearCelda(l.cantidad, "texto-derecha"));
    fila.appendChild(crearCelda(l.motivo));
    fila.appendChild(crearCelda("Q " + l.costo.toFixed(2), "texto-derecha"));
    fila.appendChild(crearCelda(aviso));

    const celdaBoton = document.createElement("td");
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn btn-secundario";
    boton.textContent = "Quitar";
    boton.addEventListener("click", () => {
      lineas.splice(indice, 1);
      renderLineas();
    });
    celdaBoton.appendChild(boton);
    fila.appendChild(celdaBoton);

    tablaLineas.appendChild(fila);
  });
}

// 8) AGREGAR UN LOTE A LA LISTA
formLinea.addEventListener("submit", (evento) => {
  evento.preventDefault();

  const idLote = parseInt(selectLote.value, 10);
  const item = inventarioTienda.find((i) => i.id_lote === idLote);
  if (!item) {
    avisar("Elige un lote de la lista.", true);
    return;
  }

  if (lineas.some((l) => l.id_lote === idLote)) {
    avisar("Ese lote ya está en la lista. Quítalo si quieres cambiar la cantidad.", true);
    return;
  }

  const cantidad = parseInt(inputCantidad.value, 10);
  if (!cantidad || cantidad < 1) {
    avisar("La cantidad debe ser al menos 1.", true);
    return;
  }
  if (cantidad > item.stock) {
    avisar(`No puedes devolver más de lo que hay en stock (${item.stock}).`, true);
    return;
  }

  lineas.push({
    id_lote: item.id_lote,
    producto: item.producto,
    numero_lote: item.numero_lote,
    vence: item.vence,
    dias: item.dias,
    cantidad: cantidad,
    motivo: selectMotivo.value,
    costo: parseFloat(inputCosto.value) || 0,
  });

  renderLineas();
  inputCantidad.value = 1;
  selectLote.value = "";
});

// Al elegir un lote, sugerir el motivo según su fecha de vencimiento
selectLote.addEventListener("change", () => {
  const item = inventarioTienda.find((i) => i.id_lote === parseInt(selectLote.value, 10));
  if (item) {
    selectMotivo.value = item.dias < 0 ? "Vencido" : "Próximo a vencer";
  }
});

// 9) EVENTOS DE LOS SELECTORES PRINCIPALES
selectTienda.addEventListener("change", () => {
  if (lineas.length > 0) {
    lineas = [];
    renderLineas();
    avisar("Cambiaste de sucursal: la lista de lotes se vació.", true);
  }
  cargarLotesDeTienda(selectTienda.value);
});

selectProveedor.addEventListener("change", () => {
  const prov = proveedorSeleccionado();
  if (prov) {
    const acepta = [];
    if (prov.acepta_canje) acepta.push("canje");
    if (prov.acepta_nota_credito) acepta.push("nota de crédito");
    infoProveedor.textContent =
      `Acepta: ${acepta.join(" y ") || "ninguna opción"}. ` +
      `Mínimo ${prov.dias_min_antes_vencimiento} días antes del vencimiento.`;
  } else {
    infoProveedor.textContent = "";
  }
  renderLineas(); // vuelve a calcular los avisos
});

// 10) REGISTRAR LA DEVOLUCIÓN EN SUPABASE
btnRegistrar.addEventListener("click", async () => {
  const idTienda = parseInt(selectTienda.value, 10);
  const idProveedor = parseInt(selectProveedor.value, 10);

  if (!idTienda) return avisar("Elige la sucursal.", true);
  if (!idProveedor) return avisar("Elige el proveedor.", true);
  if (lineas.length === 0) return avisar("Agrega al menos un lote a la lista.", true);

  btnRegistrar.disabled = true;
  btnRegistrar.textContent = "Registrando...";

  const observaciones = inputObservaciones.value.trim();
  const cabecera = {
    id_tienda: idTienda,
    id_proveedor: idProveedor,
    id_usuario: selectUsuario.value ? parseInt(selectUsuario.value, 10) : null,
    observaciones: observaciones === "" ? null : observaciones,
  };

  // Paso A: guardar el encabezado y obtener su id
  const { data: nueva, error: errorCabecera } = await db
    .from("devoluciones")
    .insert([cabecera])
    .select("id_devolucion")
    .single();

  if (errorCabecera) {
    console.error(errorCabecera);
    avisar("No se pudo registrar la devolución: " + errorCabecera.message, true);
    btnRegistrar.disabled = false;
    btnRegistrar.textContent = "Registrar devolución";
    return;
  }

  // Paso B: guardar las líneas (lotes) ligadas a ese id
  const detalle = lineas.map((l) => ({
    id_devolucion: nueva.id_devolucion,
    id_lote: l.id_lote,
    cantidad: l.cantidad,
    costo_unitario: l.costo,
    motivo: l.motivo,
  }));

  const { error: errorDetalle } = await db.from("devolucion_detalle").insert(detalle);

  if (errorDetalle) {
    console.error(errorDetalle);
    // Si fallaron las líneas, se borra el encabezado para no dejar una devolución vacía
    await db.from("devoluciones").delete().eq("id_devolucion", nueva.id_devolucion);
    avisar("No se pudieron guardar los lotes: " + errorDetalle.message, true);
    btnRegistrar.disabled = false;
    btnRegistrar.textContent = "Registrar devolución";
    return;
  }

  avisar(`Devolución #${nueva.id_devolucion} registrada con estado "En revisión".`);
  lineas = [];
  renderLineas();
  inputObservaciones.value = "";
  btnRegistrar.disabled = false;
  btnRegistrar.textContent = "Registrar devolución";
});

// 11) INICIO
renderLineas();
cargarCatalogos();