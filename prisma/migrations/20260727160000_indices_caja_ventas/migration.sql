-- "Mi turno" consulta Venta por usuarioId sobre la tabla que más crece, y el reporte
-- consolidado de gerencia filtra CajaSesion solo por fecha: ninguno tenía índice.
CREATE INDEX "Venta_usuarioId_creadoEn_idx" ON "Venta"("usuarioId", "creadoEn");
CREATE INDEX "CajaSesion_usuarioId_estado_idx" ON "CajaSesion"("usuarioId", "estado");
CREATE INDEX "CajaSesion_abiertaEn_idx" ON "CajaSesion"("abiertaEn");
