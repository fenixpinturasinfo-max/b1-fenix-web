-- Costo congelado al momento de la venta: permite calcular margen histórico real
-- sin que un cambio de costo reescriba el margen de meses anteriores.
ALTER TABLE "DetalleVenta" ADD COLUMN "costoUnitario" INTEGER NOT NULL DEFAULT 0;

-- Backfill de las ventas ya existentes con el costo actual del producto.
-- Es una aproximación (es el único dato disponible hacia atrás), pero deja
-- la columna utilizable desde el día uno en vez de con ceros.
UPDATE "DetalleVenta" dv
SET "costoUnitario" = p."precioCosto"
FROM "Producto" p
WHERE p."id" = dv."productoId" AND dv."costoUnitario" = 0;
