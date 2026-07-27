-- Movimientos de efectivo dentro del turno, fuera de las ventas.
-- Sin esto el arqueo marca un descuadre cada vez que alguien saca plata de la caja
-- para pagar un flete o hace una sangría de seguridad: el equipo aprende a ignorar
-- los rojos, que es la peor forma de perder una herramienta de control.

CREATE TYPE "TipoMovCaja" AS ENUM ('SANGRIA', 'INGRESO', 'GASTO');

CREATE TABLE "MovimientoCaja" (
    "id" TEXT NOT NULL,
    "cajaSesionId" TEXT NOT NULL,
    "tipo" "TipoMovCaja" NOT NULL,
    "monto" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MovimientoCaja_cajaSesionId_idx" ON "MovimientoCaja"("cajaSesionId");

ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_cajaSesionId_fkey"
  FOREIGN KEY ("cajaSesionId") REFERENCES "CajaSesion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- La línea de tiempo del día consulta por local y fecha de apertura
CREATE INDEX "CajaSesion_localId_abiertaEn_idx" ON "CajaSesion"("localId", "abiertaEn");
