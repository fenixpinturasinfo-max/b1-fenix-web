-- Tienda web: pedidos del carro público pagados con Webpay Plus.
--
-- El pedido online vive aparte de Venta (exige cajero y caja) y de PedidoCliente (solo
-- reserva): acá el pago llega primero y por internet. Al confirmar Webpay el stock sale
-- de inmediato del local que entrega (SALIDA_VENTA con `pedidoOnlineId`), y los montos
-- quedan congelados al iniciar el pago.
--
-- Entrega: RETIRO gratis · DESPACHO_ANILLO con tarifa fija cobrada en Webpay ·
-- DESPACHO_COURIER fuera del anillo, envío por pagar al courier elegido.

CREATE TYPE "EstadoPedidoOnline" AS ENUM ('PENDIENTE_PAGO', 'PAGADO', 'DESPACHADO', 'ENTREGADO', 'ANULADO');
CREATE TYPE "TipoEntrega" AS ENUM ('RETIRO', 'DESPACHO_ANILLO', 'DESPACHO_COURIER');

CREATE TABLE "PedidoOnline" (
    "id" TEXT NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "estado" "EstadoPedidoOnline" NOT NULL DEFAULT 'PENDIENTE_PAGO',
    "tipoEntrega" "TipoEntrega" NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "direccion" TEXT,
    "comuna" TEXT,
    "courier" TEXT,
    "montoProductos" INTEGER NOT NULL,
    "montoEnvio" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "tbkToken" TEXT,
    "tbkAutorizacion" TEXT,
    "tbkTarjeta" TEXT,
    "pagadoEn" TIMESTAMP(3),
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "despachadoEn" TIMESTAMP(3),
    "entregadoEn" TIMESTAMP(3),

    CONSTRAINT "PedidoOnline_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PedidoOnline_correlativo_key" ON "PedidoOnline"("correlativo");
CREATE UNIQUE INDEX "PedidoOnline_tbkToken_key" ON "PedidoOnline"("tbkToken");
CREATE INDEX "PedidoOnline_estado_creadoEn_idx" ON "PedidoOnline"("estado", "creadoEn");
CREATE INDEX "PedidoOnline_localId_estado_idx" ON "PedidoOnline"("localId", "estado");

CREATE TABLE "PedidoOnlineLinea" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" INTEGER NOT NULL,
    "costoUnitario" INTEGER NOT NULL DEFAULT 0,
    "subtotal" INTEGER NOT NULL,

    CONSTRAINT "PedidoOnlineLinea_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PedidoOnlineLinea_pedidoId_idx" ON "PedidoOnlineLinea"("pedidoId");

ALTER TABLE "MovimientoInventario" ADD COLUMN "pedidoOnlineId" TEXT;

ALTER TABLE "PedidoOnline"
    ADD CONSTRAINT "PedidoOnline_localId_fkey"
    FOREIGN KEY ("localId") REFERENCES "Local"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PedidoOnlineLinea"
    ADD CONSTRAINT "PedidoOnlineLinea_pedidoId_fkey"
    FOREIGN KEY ("pedidoId") REFERENCES "PedidoOnline"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PedidoOnlineLinea"
    ADD CONSTRAINT "PedidoOnlineLinea_productoId_fkey"
    FOREIGN KEY ("productoId") REFERENCES "Producto"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MovimientoInventario"
    ADD CONSTRAINT "MovimientoInventario_pedidoOnlineId_fkey"
    FOREIGN KEY ("pedidoOnlineId") REFERENCES "PedidoOnline"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
