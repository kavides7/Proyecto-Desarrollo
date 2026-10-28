// ====================================================
// MÓDULO: MENÚ DE NAVEGACIÓN GLOBAL UNIFICADO
// Dibuja la barra estándar con estilos de styles.css,
// resalta la página actual y agrega el botón de logout.
// ====================================================
(function () {
  const pantallasDevoluciones = [
    { archivo: "anaquel.html", texto: "1. Retiro de anaquel" },
    { archivo: "nueva-devolucion.html", texto: "2. Nueva devolución" },
    { archivo: "seguimiento.html", texto: "3. Seguimiento" },
    { archivo: "historial.html", texto: "4. Historial" },
    { archivo: "devoluciones.html", texto: "Proveedores" },
  ];

  const pantallasSistema = [
    { archivo: "index.html", texto: "Inventario" },
    { archivo: "kardex.html", texto: "Kardex" },
    { archivo: "vencimientos.html", texto: "Vencimientos" },
  ];

  const contenedor = document.querySelector(".contenedor");
  if (!contenedor) return;

  // Si ya existía una barra previa, se remueve para evitar duplicaciones
  const navExistente = contenedor.querySelector(".barra-navegacion");
  if (navExistente) navExistente.remove();

  // Obtener el nombre del archivo actual
  const actual = window.location.pathname.split("/").pop() || "index.html";

  // Crear la barra con la clase institucional definida en styles.css
  const nav = document.createElement("nav");
  nav.className = "barra-navegacion no-imprimir";

  // Sección Izquierda: Flujo de Devoluciones
  const seccionDevoluciones = document.createElement("div");
  seccionDevoluciones.className = "nav-seccion";

  const labelDev = document.createElement("span");
  labelDev.className = "nav-label";
  labelDev.textContent = "Devoluciones:";
  seccionDevoluciones.appendChild(labelDev);

  pantallasDevoluciones.forEach((p) => {
    const enlace = document.createElement("a");
    enlace.href = p.archivo;
    enlace.textContent = p.texto;
    enlace.className = `nav-link ${p.archivo === actual ? "activo" : ""}`;
    seccionDevoluciones.appendChild(enlace);
  });

  // Sección Derecha: Módulos Principales + Cerrar Sesión
  const seccionSistema = document.createElement("div");
  seccionSistema.className = "nav-seccion";

  pantallasSistema.forEach((p) => {
    const enlace = document.createElement("a");
    enlace.href = p.archivo;
    enlace.textContent = p.texto;
    enlace.className = `nav-link ${p.archivo === actual ? "activo" : ""}`;
    seccionSistema.appendChild(enlace);
  });

  
  nav.appendChild(seccionDevoluciones);
  nav.appendChild(seccionSistema);

  // Inyectar al inicio del contenedor
  contenedor.insertBefore(nav, contenedor.firstChild);
})();