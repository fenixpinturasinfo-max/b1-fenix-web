-- Marca Premium en la venta.
--
-- No toca subtotal ni total: es una marca comercial, no un precio ni un descuento. Sirve
-- para que el reporte pueda separar las ventas Premium por vendedor y por local, y para
-- que la boleta la muestre. Si más adelante Premium tiene que cambiar el precio, ese es
-- otro cambio: implica una lista de precios y recalcular el carro antes del cierre.

ALTER TABLE "Venta" ADD COLUMN "premium" BOOLEAN NOT NULL DEFAULT false;

-- El reporte de ventas Premium filtra por esta columna sobre la tabla que más crece
CREATE INDEX "Venta_localId_premium_creadoEn_idx" ON "Venta"("localId", "premium", "creadoEn");
