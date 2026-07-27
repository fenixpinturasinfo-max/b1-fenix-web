-- Toma de inventario: conteo físico como proceso, no como ajuste suelto.
-- Un AJUSTE corrige un producto; una toma se abre, se cuenta por partes, se revisa
-- y recién después toca el stock, con quien cuenta y quien aplica separados.

CREATE TYPE "EstadoToma" AS ENUM ('ABIERTA', 'CONTADA', 'APLICADA', 'ANULADA');
CREATE TYPE "AlcanceToma" AS ENUM ('TOTAL', 'CATEGORIA', 'UBICACION', 'MARCA', 'ALTO_VALOR');
CREATE TYPE "MotivoAjuste" AS ENUM ('MERMA', 'ROBO', 'ERROR_RECEPCION', 'ERROR_CONTEO', 'VENCIDO', 'OTRO');

CREATE TABLE "TomaInventario" (
    "id" TEXT NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "localId" TEXT NOT NULL,
    "estado" "EstadoToma" NOT NULL DEFAULT 'ABIERTA',
    "alcance" "AlcanceToma" NOT NULL,
    "filtro" TEXT,
    "ciego" BOOLEAN NOT NULL DEFAULT true,
    "nota" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradaEn" TIMESTAMP(3),
    "aplicadaPorId" TEXT,
    "aplicadaEn" TIMESTAMP(3),

    CONSTRAINT "TomaInventario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TomaLinea" (
    "id" TEXT NOT NULL,
    "tomaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "esperado" INTEGER NOT NULL,
    "contado" INTEGER,
    "contadoEn" TIMESTAMP(3),
    "motivo" "MotivoAjuste",
    "saltada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TomaLinea_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MovimientoInventario" ADD COLUMN "tomaLineaId" TEXT;

CREATE UNIQUE INDEX "TomaInventario_correlativo_key" ON "TomaInventario"("correlativo");
CREATE INDEX "TomaInventario_localId_estado_idx" ON "TomaInventario"("localId", "estado");
CREATE UNIQUE INDEX "TomaLinea_tomaId_productoId_key" ON "TomaLinea"("tomaId", "productoId");
CREATE INDEX "TomaLinea_tomaId_idx" ON "TomaLinea"("tomaId");
CREATE UNIQUE INDEX "MovimientoInventario_tomaLineaId_key" ON "MovimientoInventario"("tomaLineaId");

ALTER TABLE "TomaInventario" ADD CONSTRAINT "TomaInventario_localId_fkey"
  FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TomaInventario" ADD CONSTRAINT "TomaInventario_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TomaInventario" ADD CONSTRAINT "TomaInventario_aplicadaPorId_fkey"
  FOREIGN KEY ("aplicadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TomaLinea" ADD CONSTRAINT "TomaLinea_tomaId_fkey"
  FOREIGN KEY ("tomaId") REFERENCES "TomaInventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TomaLinea" ADD CONSTRAINT "TomaLinea_productoId_fkey"
  FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_tomaLineaId_fkey"
  FOREIGN KEY ("tomaLineaId") REFERENCES "TomaLinea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Bodega cuenta y cierra; el encargado revisa y aplica. Esa separación es el control.
INSERT INTO "PermisoPerfil" ("id", "rol", "seccion", "nivel") VALUES
  (gen_random_uuid()::text, 'GERENTE', 'inventario.toma', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'inventario.toma-aprobar', 'TOTAL'),
  (gen_random_uuid()::text, 'JEFE_LOCAL', 'inventario.toma', 'TOTAL'),
  (gen_random_uuid()::text, 'JEFE_LOCAL', 'inventario.toma-aprobar', 'TOTAL'),
  (gen_random_uuid()::text, 'BODEGA', 'inventario.toma', 'TOTAL')
ON CONFLICT ("rol", "seccion") DO NOTHING;
