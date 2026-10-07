-- Vista para el panel de notificaciones de vencimientos
CREATE OR REPLACE VIEW vista_vencimientos AS
SELECT 
    i.id_inventario,
    t.nombre AS sucursal,
    p.nombre AS medicamento,
    l.numero_lote AS lote,
    l.fecha_vencimiento,
    i.stock_actual AS stock,
    (l.fecha_vencimiento - CURRENT_DATE) AS dias_restantes
FROM inventario i
JOIN tiendas t ON i.id_tienda = t.id_tienda
JOIN lotes l ON i.id_lote = l.id_lote
JOIN productos p ON l.id_producto = p.id_producto
WHERE i.stock_actual > 0
ORDER BY l.fecha_vencimiento ASC;
