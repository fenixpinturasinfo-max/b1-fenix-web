-- Descuento a nivel de cliente + aprobación de descuentos por correo.
--
-- 1. La ficha del cliente gana un porcentaje de descuento pactado. En el POS basta con
--    ingresar el RUT para que se aplique solo, y en la factura se precarga al elegir el
--    cliente: quien lo configuró en la ficha ya lo autorizó. Parte en 0 para todos.
--
-- 2. La venta guarda a qué cliente se le vendió (`clienteId`). Antes la boleta era
--    siempre anónima; sin este vínculo el descuento automático no tendría a quién
--    atribuirse ni forma de auditarse.
--
-- 3. `SolicitudDescuento`: cuando el descuento pedido supera lo que el cajero puede
--    aplicar solo (tramo libre + descuento del cliente), además de la autorización
--    presencial existe el camino remoto: correo a gerencia con enlaces de un clic.
--    La solicitud registra quién pidió, cuánto, y quién resolvió.

ALTER TABLE "SocioNegocio" ADD COLUMN "descuentoPorcentaje" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Venta" ADD COLUMN "clienteId" TEXT;

-- SET NULL por la misma razón que `descuentoAutorizadoPorId`: si algún día se borra una
-- ficha, es preferible una venta con el cliente en blanco que una venta imborrable.
ALTER TABLE "Venta"
    ADD CONSTRAINT "Venta_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "SocioNegocio"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Venta_clienteId_idx" ON "Venta"("clienteId");

CREATE TYPE "EstadoSolicitudDescuento" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

CREATE TABLE "SolicitudDescuento" (
    "id" TEXT NOT NULL,
    "estado" "EstadoSolicitudDescuento" NOT NULL DEFAULT 'PENDIENTE',
    "contexto" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "clienteId" TEXT,
    "base" INTEGER NOT NULL,
    "monto" INTEGER NOT NULL,
    "motivo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "resueltaEn" TIMESTAMP(3),
    "resueltaPorId" TEXT,

    CONSTRAINT "SolicitudDescuento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SolicitudDescuento_solicitanteId_creadoEn_idx"
    ON "SolicitudDescuento"("solicitanteId", "creadoEn");
CREATE INDEX "SolicitudDescuento_estado_creadoEn_idx"
    ON "SolicitudDescuento"("estado", "creadoEn");

ALTER TABLE "SolicitudDescuento"
    ADD CONSTRAINT "SolicitudDescuento_localId_fkey"
    FOREIGN KEY ("localId") REFERENCES "Local"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SolicitudDescuento"
    ADD CONSTRAINT "SolicitudDescuento_solicitanteId_fkey"
    FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SolicitudDescuento"
    ADD CONSTRAINT "SolicitudDescuento_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "SocioNegocio"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SolicitudDescuento"
    ADD CONSTRAINT "SolicitudDescuento_resueltaPorId_fkey"
    FOREIGN KEY ("resueltaPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
