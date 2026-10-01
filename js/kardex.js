const SUPABASE_URL = "https://falivfgdcqglihwkogvp.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_3W0pALYuAuT75HQG4Upd6A_0odpQzau";

const client = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// ELEMENTOS

const filtroProducto =
    document.getElementById("filtro-producto");

const filtroTienda =
    document.getElementById("filtro-tienda");

const filtroLote =
    document.getElementById("filtro-lote");

const filtroTipo =
    document.getElementById("filtro-tipo");

const fechaDesde =
    document.getElementById("fecha-desde");

const fechaHasta =
    document.getElementById("fecha-hasta");

const tablaKardex =
    document.getElementById("tabla-kardex");

const totalMovimientos =
    document.getElementById("total-movimientos");

const btnConsultar =
    document.getElementById("btn-consultar");

const btnLimpiar =
    document.getElementById("btn-limpiar");


// ======================================
// CARGAR FILTROS
// ======================================

async function cargarFiltros() {

    try {

        const { data: productos, error: errorProductos } =
            await client
                .from("productos")
                .select("id_producto, nombre")
                .order("nombre");

        if (errorProductos)
            throw errorProductos;


        productos.forEach(producto => {

            filtroProducto.innerHTML += `
                <option value="${producto.id_producto}">
                    ${producto.nombre}
                </option>
            `;

        });


        const { data: tiendas, error: errorTiendas } =
            await client
                .from("tiendas")
                .select("id_tienda, nombre")
                .order("nombre");

        if (errorTiendas)
            throw errorTiendas;


        tiendas.forEach(tienda => {

            filtroTienda.innerHTML += `
                <option value="${tienda.id_tienda}">
                    ${tienda.nombre}
                </option>
            `;

        });


        const { data: lotes, error: errorLotes } =
            await client
                .from("lotes")
                .select(`
                    id_lote,
                    numero_lote,
                    productos(nombre)
                `);

        if (errorLotes)
            throw errorLotes;


        lotes.forEach(lote => {

            filtroLote.innerHTML += `
                <option value="${lote.id_lote}">
                    ${lote.numero_lote}
                    - ${lote.productos?.nombre || ""}
                </option>
            `;

        });

    }
    catch (error) {

        console.error(
            "Error cargando filtros:",
            error
        );

    }
}


// ======================================
// CONSULTAR KARDEX
// ======================================

async function consultarKardex() {

    tablaKardex.innerHTML = `
        <tr>
            <td colspan="7"
                class="texto-centro">
                Consultando movimientos...
            </td>
        </tr>
    `;


    let consulta = client
        .from("movimientos_stock")
        .select(`
            id_movimiento,
            tipo_movimiento,
            cantidad,
            saldo_anterior,
            saldo_resultante,
            observacion,
            fecha_movimiento,
            id_tienda,
            id_lote,

            tiendas (
                nombre
            ),

            lotes (
                id_producto,
                numero_lote,

                productos (
                    nombre
                )
            )
        `)
        .order(
            "fecha_movimiento",
            { ascending: false }
        );


    // SUCURSAL

    if (filtroTienda.value) {

        consulta = consulta.eq(
            "id_tienda",
            filtroTienda.value
        );

    }


    // LOTE

    if (filtroLote.value) {

        consulta = consulta.eq(
            "id_lote",
            filtroLote.value
        );

    }


    // MOVIMIENTO

    if (filtroTipo.value) {

        consulta = consulta.eq(
            "tipo_movimiento",
            filtroTipo.value
        );

    }


    // FECHA DESDE

    if (fechaDesde.value) {

        consulta = consulta.gte(
            "fecha_movimiento",
            `${fechaDesde.value}T00:00:00`
        );

    }


    // FECHA HASTA

    if (fechaHasta.value) {

        consulta = consulta.lte(
            "fecha_movimiento",
            `${fechaHasta.value}T23:59:59`
        );

    }


    const { data, error } =
        await consulta;


    if (error) {

        console.error(
            "Error consultando Kardex:",
            error
        );

        tablaKardex.innerHTML = `
            <tr>
                <td colspan="7"
                    class="texto-centro">
                    Error al consultar el Kardex.
                </td>
            </tr>
        `;

        return;
    }


    // FILTRO PRODUCTO

    let movimientos = data || [];


    if (filtroProducto.value) {

        movimientos =
            movimientos.filter(movimiento =>

                movimiento.lotes?.id_producto ==
                filtroProducto.value

            );

    }


    mostrarMovimientos(movimientos);

}


// ======================================
// MOSTRAR TABLA
// ======================================

function mostrarMovimientos(movimientos) {

    totalMovimientos.textContent =
        `${movimientos.length} movimiento(s)`;


    if (movimientos.length === 0) {

        tablaKardex.innerHTML = `
            <tr>
                <td colspan="7"
                    class="texto-centro">
                    No se encontraron movimientos.
                </td>
            </tr>
        `;

        return;
    }


    tablaKardex.innerHTML =
        movimientos.map(movimiento => {

            const esEntrada = [
                "COMPRA",
                "AJUSTE_POSITIVO",
                "TRASLADO_ENTRADA"
            ].includes(
                movimiento.tipo_movimiento
            );


            const entrada =
                esEntrada
                    ? movimiento.cantidad
                    : "-";


            const salida =
                !esEntrada
                    ? movimiento.cantidad
                    : "-";


            const fecha =
                new Date(
                    movimiento.fecha_movimiento
                ).toLocaleString("es-GT");


            return `

                <tr>

                    <td>${fecha}</td>

                    <td>
                        ${movimiento.tiendas?.nombre || "N/A"}
                    </td>

                    <td>
                        <strong>
                            ${movimiento.lotes?.productos?.nombre || "N/A"}
                        </strong>
                    </td>

                    <td>
                        <code>
                            ${movimiento.lotes?.numero_lote || "N/A"}
                        </code>
                    </td>

                    <td>
                        <span class="tipo-movimiento">
                            ${movimiento.tipo_movimiento}
                        </span>
                    </td>

                    <td>
                        ${movimiento.observacion || "-"}
                    </td>

                    <td class="
                        texto-derecha
                        movimiento-entrada
                    ">
                        ${entrada}
                    </td>

                    <td class="
                        texto-derecha
                        movimiento-salida
                    ">
                        ${salida}
                    </td>
                    <td class="texto-derecha">
                        <strong>
                            ${movimiento.saldo_resultante ?? "-"}
                        </strong>
                    </td>

                </tr>

            `;

        }).join("");

}


// ======================================
// EVENTOS
// ======================================

btnConsultar.addEventListener(
    "click",
    consultarKardex
);


btnLimpiar.addEventListener(
    "click",
    () => {

        filtroProducto.value = "";
        filtroTienda.value = "";
        filtroLote.value = "";
        filtroTipo.value = "";
        fechaDesde.value = "";
        fechaHasta.value = "";

        consultarKardex();

    }
);


// ======================================
// INICIALIZAR
// ======================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await cargarFiltros();
        await consultarKardex();

    }
);