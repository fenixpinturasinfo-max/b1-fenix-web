-- Conteo por planilla: fecha real del conteo, autoría por línea y trazabilidad del origen.
--
-- El campo clave es TomaInventario.fechaConteo. El ajuste de una toma se calcula como
-- `contado + movimientos posteriores a contadoEn`. Contando en el móvil, contadoEn es el
-- instante del tecleo y eso es correcto. Con planilla se cuenta un día y se digita otro:
-- si contadoEn fuera la fecha del upload, las ventas ocurridas entremedio no se sumarían
-- de vuelta y aparecerían como faltantes que nadie causó.

CREATE TYPE "OrigenLinea" AS ENUM ('ALCANCE', 'AGREGADA_MANUAL', 'AGREGADA_IMPORT');
CREATE TYPE "OrigenConteo" AS ENUM ('MOVIL', 'PLANILLA');

ALTER TABLE "TomaInventario" ADD COLUMN "fechaConteo" TIMESTAMP(3);

ALTER TABLE "TomaLinea" ADD COLUMN "contadoPorId" TEXT;
ALTER TABLE "TomaLinea" ADD COLUMN "origen" "OrigenLinea" NOT NULL DEFAULT 'ALCANCE';
ALTER TABLE "TomaLinea" ADD COLUMN "origenConteo" "OrigenConteo";

-- SET NULL: borrar un usuario no debe borrar el conteo que hizo
ALTER TABLE "TomaLinea" ADD CONSTRAINT "TomaLinea_contadoPorId_fkey"
  FOREIGN KEY ("contadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Las líneas ya contadas antes de esta migración vinieron del contador móvil
UPDATE "TomaLinea" SET "origenConteo" = 'MOVIL' WHERE "contado" IS NOT NULL;
