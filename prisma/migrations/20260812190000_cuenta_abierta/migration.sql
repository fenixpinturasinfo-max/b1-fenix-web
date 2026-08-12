-- Cuenta abierta: retiros a cuenta de clientes especiales y cobro consolidado.
--
-- El patrón es el de SAP B1: la Entrega mueve inventario, la Factura solo cobra.
-- Cada retiro rebaja stock al momento y congela precio/costo del día; al cierre del
-- período (semana, quincena o mes, lo decide el negocio) los retiros ABIERTOS se
-- consolidan en una boleta o factura que NO vuelve a mover stock.
--
-- La salida de inventario va como SALIDA_VENTA con `retiroCuentaId`: para el stock es
-- una venta, y el vínculo la distingue sin obligar a enseñarle un tipo nuevo a cada
-- pantalla de movimientos.

ALTER TABLE "SocioNegocio" ADD COLUMN "cuentaAbierta" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "EstadoRetiroCuenta" AS ENUM ('ABIERTO', 'COBRADO', 'ANULADO');

CREATE TABLE "RetiroCuenta" (
    "id" TEXT NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "clienteId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "estado" "EstadoRetiroCuenta" NOT NULL DEFAULT 'ABIERTO',
    "total" INTEGER NOT NULL,
    "nota" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ventaId" TEXT,
    "facturaVentaId" TEXT,
    "cobradoEn" TIMESTAMP(3),
    "anuladoPorId" TEXT,
    "anuladoEn" TIMESTAMP(3),
    "motivoAnulacion" TEXT,

    CONSTRAINT "RetiroCuenta_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RetiroCuenta_correlativo_key" ON "RetiroCuenta"("correlativo");
CREATE INDEX "RetiroCuenta_clienteId_estado_idx" ON "RetiroCuenta"("clienteId", "estado");
CREATE INDEX "RetiroCuenta_localId_estado_idx" ON "RetiroCuenta"("localId", "estado");
CREATE INDEX "RetiroCuenta_estado_creadoEn_idx" ON "RetiroCuenta"("estado", "creadoEn");

CREATE TABLE "RetiroCuentaLinea" (
    "id" TEXT NOT NULL,
    "retiroId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" INTEGER NOT NULL,
    "costoUnitario" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,

    CONSTRAINT "RetiroCuentaLinea_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RetiroCuentaLinea_retiroId_idx" ON "RetiroCuentaLinea"("retiroId");

ALTER TABLE "MovimientoInventario" ADD COLUMN "retiroCuentaId" TEXT;

ALTER TABLE "RetiroCuenta"
    ADD CONSTRAINT "RetiroCuenta_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "SocioNegocio"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RetiroCuenta"
    ADD CONSTRAINT "RetiroCuenta_localId_fkey"
    FOREIGN KEY ("localId") REFERENCES "Local"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RetiroCuenta"
    ADD CONSTRAINT "RetiroCuenta_creadoPorId_fkey"
    FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RetiroCuenta"
    ADD CONSTRAINT "RetiroCuenta_ventaId_fkey"
    FOREIGN KEY ("ventaId") REFERENCES "Venta"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RetiroCuenta"
    ADD CONSTRAINT "RetiroCuenta_facturaVentaId_fkey"
    FOREIGN KEY ("facturaVentaId") REFERENCES "FacturaVenta"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RetiroCuenta"
    ADD CONSTRAINT "RetiroCuenta_anuladoPorId_fkey"
    FOREIGN KEY ("anuladoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RetiroCuentaLinea"
    ADD CONSTRAINT "RetiroCuentaLinea_retiroId_fkey"
    FOREIGN KEY ("retiroId") REFERENCES "RetiroCuenta"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RetiroCuentaLinea"
    ADD CONSTRAINT "RetiroCuentaLinea_productoId_fkey"
    FOREIGN KEY ("productoId") REFERENCES "Producto"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MovimientoInventario"
    ADD CONSTRAINT "MovimientoInventario_retiroCuentaId_fkey"
    FOREIGN KEY ("retiroCuentaId") REFERENCES "RetiroCuenta"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
