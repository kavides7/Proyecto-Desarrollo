-- =====================================================================
-- MODULO 4: MEJORA DEL TRIGGER DE HISTORIAL DE LIQUIDACIONES
-- Ejecutar en: Supabase > SQL Editor > New query > Run
--
-- Antes, cada cambio de estado quedaba con el comentario generico
-- "Cambio de estado". Ahora el historial describe lo que paso:
--   - Aceptado: resultado (canje / nota de credito), monto y documento
--   - Rechazado: queda indicado el rechazo
--
-- El trigger "trg_historial_devolucion" ya existe y llama a esta funcion,
-- asi que solo hay que reemplazar la funcion (no se toca la tabla).
-- =====================================================================

create or replace function registrar_historial_devolucion()
returns trigger as $$
declare
    v_comentario text;
begin
    if (tg_op = 'INSERT') then
        insert into historial_liquidaciones
            (id_devolucion, id_usuario, estado_anterior, estado_nuevo, comentario)
        values
            (new.id_devolucion, new.id_usuario, null, new.estado, 'Devolución registrada');

    elsif (tg_op = 'UPDATE' and new.estado is distinct from old.estado) then

        if new.estado = 'Aceptado' then
            v_comentario := 'Aceptado por el proveedor: '
                || coalesce(new.resultado, 'sin resultado')
                || ', monto Q ' || to_char(new.monto_liquidado, 'FM9999999990.00')
                || ', documento ' || coalesce(new.numero_documento, 's/n');
        elsif new.estado = 'Rechazado' then
            v_comentario := 'Rechazado por el proveedor';
        else
            v_comentario := 'Cambio de estado';
        end if;

        insert into historial_liquidaciones
            (id_devolucion, id_usuario, estado_anterior, estado_nuevo, comentario)
        values
            (new.id_devolucion, new.id_usuario, old.estado, new.estado, v_comentario);
    end if;

    return new;
end;
$$ language plpgsql;


-- ---------------------------------------------------------------------
-- OPCIONAL: actualizar los registros de prueba que ya existen
-- (los que quedaron con el comentario generico "Cambio de estado").
-- Quita los "--" si quieres ejecutarlo. Solo es correcto para
-- devoluciones que fueron resueltas UNA sola vez.
-- ---------------------------------------------------------------------
-- update historial_liquidaciones h
-- set comentario = case
--         when d.estado = 'Aceptado' then
--             'Aceptado por el proveedor: ' || coalesce(d.resultado, 'sin resultado')
--             || ', monto Q ' || to_char(d.monto_liquidado, 'FM9999999990.00')
--             || ', documento ' || coalesce(d.numero_documento, 's/n')
--         when d.estado = 'Rechazado' then 'Rechazado por el proveedor'
--     end
-- from devoluciones d
-- where h.id_devolucion = d.id_devolucion
--   and h.estado_nuevo = d.estado
--   and h.estado_nuevo in ('Aceptado', 'Rechazado')
--   and h.comentario = 'Cambio de estado';
