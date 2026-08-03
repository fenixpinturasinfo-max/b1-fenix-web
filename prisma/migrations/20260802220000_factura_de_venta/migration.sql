-- Factura de venta.
--
-- A diferencia del pedido —que solo reserva— la factura ES la venta: descuenta stock y
-- genera los movimientos, igual que una boleta del POS. Es el camino del cliente empresa
-- que no pasa por caja y paga a plazo.
--
-- El neto se calcula sumando 19% al precio de catálogo, no desglosándolo: acá el precio de
-- lista se toma como valor neto. Consecuencia deliberada: el total de una factura creada
-- desde un pedido es 19% mayor que el total del pedido, que sí es IVA incluido.

-- Un pedido facturado no vuelve a pasar por el POS: el stock ya salió
ALTER TYPE "EstadoPedido" ADD VALUE 'FACTURADO';

CREATE TABLE "FacturaVenta" (
    "id" TEXT NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "folioSii" TEXT,
    "clienteId" TEXT NOT NULL,
    "pedidoId" TEXT,
    "localId" TEXT NOT NULL,
    "neto" INTEGER NOT NULL,
    "iva" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "condicionPago" TEXT,
    "fechaVencimiento" TIMESTAMP(3),
    "estado" "EstadoFactura" NOT NULL DEFAULT 'ABIERTA',
    "nota" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pagadaEn" TIMESTAMP(3),
    "anuladaPorId" TEXT,
    "anuladaEn" TIMESTAMP(3),
    "motivoAnulacion" TEXT,

    CONSTRAINT "FacturaVenta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FacturaVentaLinea" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "costoUnitario" INTEGER NOT NULL,

    CONSTRAINT "FacturaVentaLinea_pkey" PRIMARY KEY ("id")
);

-- Salida de stock por factura: el equivalente de ventaId para el camino sin caja
ALTER TABLE "MovimientoInventario" ADD COLUMN "facturaVentaId" TEXT;

CREATE UNIQUE INDEX "FacturaVenta_correlativo_key" ON "FacturaVenta"("correlativo");
-- Un pedido se factura una sola vez
CREATE UNIQUE INDEX "FacturaVenta_pedidoId_key" ON "FacturaVenta"("pedidoId");
CREATE INDEX "FacturaVenta_estado_fechaVencimiento_idx" ON "FacturaVenta"("estado", "fechaVencimiento");
CREATE INDEX "FacturaVenta_localId_creadoEn_idx" ON "FacturaVenta"("localId", "creadoEn");
CREATE INDEX "FacturaVentaLinea_facturaId_idx" ON "FacturaVentaLinea"("facturaId");

ALTER TABLE "FacturaVenta" ADD CONSTRAINT "FacturaVenta_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "SocioNegocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FacturaVenta" ADD CONSTRAINT "FacturaVenta_pedidoId_fkey"
  FOREIGN KEY ("pedidoId") REFERENCES "PedidoCliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FacturaVenta" ADD CONSTRAINT "FacturaVenta_localId_fkey"
  FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FacturaVenta" ADD CONSTRAINT "FacturaVenta_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FacturaVenta" ADD CONSTRAINT "FacturaVenta_anuladaPorId_fkey"
  FOREIGN KEY ("anuladaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FacturaVentaLinea" ADD CONSTRAINT "FacturaVentaLinea_facturaId_fkey"
  FOREIGN KEY ("facturaId") REFERENCES "FacturaVenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacturaVentaLinea" ADD CONSTRAINT "FacturaVentaLinea_productoId_fkey"
  FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_facturaVentaId_fkey"
  FOREIGN KEY ("facturaVentaId") REFERENCES "FacturaVenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Permisos por defecto de la sección nueva, coherentes con la matriz del catálogo.
-- Vendedor y Bodega quedan fuera: facturar a crédito compromete plata de la empresa.
INSERT INTO "PermisoPerfil" ("id", "rol", "seccion", "nivel") VALUES
  (gen_random_uuid()::text, 'GERENTE', 'ventas.facturas', 'TOTAL'),
  (gen_random_uuid()::text, 'JEFE_LOCAL', 'ventas.facturas', 'TOTAL')
ON CONFLICT ("rol", "seccion") DO NOTHING;
