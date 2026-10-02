// ====================================================
// MÓDULO 4: MENÚ DE NAVEGACIÓN (Integrante 4)
// Se agrega con una sola línea en cada pantalla del módulo:
//   <script src="js/nav-devoluciones.js"></script>
// Dibuja una barra con los enlaces y resalta la pantalla actual.
// Para agregar o quitar una pantalla, solo se edita la lista de abajo.
// ====================================================
(function () {
  // Pantallas del módulo, en el orden del flujo de trabajo
  const pantallas = [
    { archivo: "anaquel.html", texto: "1. Retiro de anaquel" },
    { archivo: "nueva-devolucion.html", texto: "2. Nueva devolución" },
    { archivo: "seguimiento.html", texto: "3. Seguimiento" },
    { archivo: "historial.html", texto: "4. Historial" },
    { archivo: "devoluciones.html", texto: "Proveedores" },
  ];

  // Enlaces a las pantallas del resto del sistema
  const sistema = [
    { archivo: "index.html", texto: "Inventario" },
    { archivo: "kardex.html", texto: "Kardex" },
  ];

  const contenedor = document.querySelector(".contenedor");
  if (!contenedor) return;

  // Nombre del archivo de la página actual (por ejemplo "seguimiento.html")
  const actual = window.location.pathname.split("/").pop() || "index.html";

  function crearEnlace(pantalla, esDelModulo) {
    const enlace = document.createElement("a");
    enlace.href = pantalla.archivo;
    enlace.textContent = pantalla.texto;

    const esActual = pantalla.archivo === actual;
    enlace.style.cssText =
      "text-decoration:none; padding:0.4rem 0.8rem; border-radius:8px; font-size:0.9rem; " +
      (esActual
        ? "background:#065f46; color:#fff; font-weight:600;"
        : esDelModulo
        ? "color:#065f46; font-weight:500;"
        : "color:#6b7280;");
    if (esActual) enlace.setAttribute("aria-current", "page");
    return enlace;
  }

  const nav = document.createElement("nav");
  nav.className = "no-imprimir"; // no sale al imprimir (clase definida en historial.html)
  nav.style.cssText =
    "display:flex; flex-wrap:wrap; gap:0.25rem; align-items:center; margin-bottom:1rem; " +
    "padding:0.5rem 0.75rem; background:#fff; border:1px solid #e5e7eb; border-radius:12px;";

  const titulo = document.createElement("strong");
  titulo.textContent = "Devoluciones:";
  titulo.style.cssText = "margin-right:0.5rem; font-size:0.9rem;";
  nav.appendChild(titulo);

  pantallas.forEach((p) => nav.appendChild(crearEnlace(p, true)));

  const separador = document.createElement("span");
  separador.textContent = "|";
  separador.style.cssText = "color:#d1d5db; margin:0 0.5rem;";
  nav.appendChild(separador);

  sistema.forEach((p) => nav.appendChild(crearEnlace(p, false)));

  // Se coloca como primer elemento de la página, arriba del encabezado
  contenedor.insertBefore(nav, contenedor.firstChild);
})();