-- Anulación de una toma de inventario.
--
-- El estado ANULADA ya existía en el enum, pero sin rastro de quién descartó el conteo
-- ni por qué. Anular no toca el stock: descarta trabajo de bodega ya hecho, así que la
-- decisión tiene que quedar atribuida igual que la de aplicar.

ALTER TABLE "TomaInventario" ADD COLUMN "anuladaPorId" TEXT;
ALTER TABLE "TomaInventario" ADD COLUMN "anuladaEn" TIMESTAMP(3);
ALTER TABLE "TomaInventario" ADD COLUMN "motivoAnulacion" TEXT;

-- SET NULL igual que aplicadaPorId: borrar un usuario no debe borrar la toma
ALTER TABLE "TomaInventario" ADD CONSTRAINT "TomaInventario_anuladaPorId_fkey"
  FOREIGN KEY ("anuladaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
