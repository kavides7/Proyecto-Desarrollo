-- =====================================================================
-- MODULO 4: FUNCION PARA REGISTRAR UNA DEVOLUCION Y DESCONTAR STOCK
-- Ejecutar en: Supabase > SQL Editor > New query > Run
--
-- Que hace (todo en UNA sola operacion: o se hace todo, o no se hace nada):
--   1. Crea el encabezado en "devoluciones" (estado: En revision)
--   2. Por cada lote: valida que haya stock suficiente en la tienda
--   3. Guarda la linea en "devolucion_detalle"
--   4. Resta la cantidad en "inventario" (stock_actual)
--   5. Registra un movimiento tipo DEVOLUCION_PROVEEDOR en "movimientos_stock"
--
-- Si algo falla (por ejemplo, stock insuficiente), no se guarda nada.
-- =====================================================================

create or replace function registrar_devolucion(
    p_id_tienda      integer,
    p_id_proveedor   integer,
    p_id_usuario     integer,
    p_observaciones  text,
    p_lineas         jsonb      -- lista de lotes: [{id_lote, cantidad, costo_unitario, motivo}, ...]
)
returns integer
language plpgsql
as $$
declare
    v_id_devolucion integer;
    v_linea         jsonb;
    v_id_lote       integer;
    v_cantidad      integer;
    v_stock         integer;
begin
    if p_lineas is null or jsonb_array_length(p_lineas) = 0 then
        raise exception 'La devolución debe tener al menos un lote.';
    end if;

    -- 1) Encabezado de la devolucion
    insert into devoluciones (id_tienda, id_proveedor, id_usuario, observaciones)
    values (p_id_tienda, p_id_proveedor, p_id_usuario, p_observaciones)
    returning id_devolucion into v_id_devolucion;

    -- 2) Recorrer cada lote de la lista
    for v_linea in select * from jsonb_array_elements(p_lineas)
    loop
        v_id_lote  := (v_linea->>'id_lote')::integer;
        v_cantidad := (v_linea->>'cantidad')::integer;

        if v_cantidad is null or v_cantidad < 1 then
            raise exception 'La cantidad del lote % debe ser al menos 1.', v_id_lote;
        end if;

        -- Bloquea la fila de inventario mientras trabajamos (evita que dos
        -- personas descuenten al mismo tiempo y dejen el stock mal)
        select stock_actual
          into v_stock
          from inventario
         where id_tienda = p_id_tienda
           and id_lote   = v_id_lote
           for update;

        if v_stock is null then
            raise exception 'El lote % no existe en el inventario de la tienda %.', v_id_lote, p_id_tienda;
        end if;

        if v_stock < v_cantidad then
            raise exception 'Stock insuficiente para el lote %: hay %, se piden %.',
                            v_id_lote, v_stock, v_cantidad;
        end if;

        -- 3) Linea de detalle
        insert into devolucion_detalle (id_devolucion, id_lote, cantidad, costo_unitario, motivo)
        values (
            v_id_devolucion,
            v_id_lote,
            v_cantidad,
            coalesce((v_linea->>'costo_unitario')::numeric, 0),
            coalesce(v_linea->>'motivo', 'Próximo a vencer')
        );

        -- 4) Descontar del inventario
        update inventario
           set stock_actual = stock_actual - v_cantidad
         where id_tienda = p_id_tienda
           and id_lote   = v_id_lote;

        -- 5) Dejar rastro en el Kardex (movimientos_stock), con saldos y referencia
        --    para que la pantalla de Kardex muestre el saldo de este movimiento
        insert into movimientos_stock
            (id_tienda, id_lote, tipo_movimiento, cantidad,
             saldo_anterior, saldo_resultante, observacion, referencia)
        values
            (p_id_tienda, v_id_lote, 'DEVOLUCION_PROVEEDOR', v_cantidad,
             v_stock, v_stock - v_cantidad,
             'Devolución a proveedor #' || v_id_devolucion,
             'DEV-' || v_id_devolucion);
    end loop;

    return v_id_devolucion;
end;
$$;

-- Avisa a la API de Supabase que hay una funcion nueva
notify pgrst, 'reload schema';
