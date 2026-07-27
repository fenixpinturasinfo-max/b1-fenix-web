-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('ABIERTA', 'PAGADA', 'ANULADA');

-- CreateTable
CREATE TABLE "FacturaCompra" (
    "id" TEXT NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "esRecepcionDirecta" BOOLEAN NOT NULL DEFAULT false,
    "neto" INTEGER NOT NULL,
    "iva" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3),
    "estado" "EstadoFactura" NOT NULL DEFAULT 'ABIERTA',
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacturaCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturaCompraLinea" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costoUnitario" INTEGER NOT NULL,

    CONSTRAINT "FacturaCompraLinea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaCredito" (
    "id" TEXT NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "facturaId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaCredito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaCreditoLinea" (
    "id" TEXT NOT NULL,
    "notaCreditoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costoUnitario" INTEGER NOT NULL,

    CONSTRAINT "NotaCreditoLinea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FacturaCompra_correlativo_key" ON "FacturaCompra"("correlativo");

-- CreateIndex
CREATE UNIQUE INDEX "FacturaCompra_ordenCompraId_key" ON "FacturaCompra"("ordenCompraId");

-- CreateIndex
CREATE INDEX "FacturaCompra_estado_fechaVencimiento_idx" ON "FacturaCompra"("estado", "fechaVencimiento");

-- CreateIndex
CREATE INDEX "FacturaCompraLinea_facturaId_idx" ON "FacturaCompraLinea"("facturaId");

-- CreateIndex
CREATE UNIQUE INDEX "NotaCredito_correlativo_key" ON "NotaCredito"("correlativo");

-- CreateIndex
CREATE INDEX "NotaCreditoLinea_notaCreditoId_idx" ON "NotaCreditoLinea"("notaCreditoId");

-- AddForeignKey
ALTER TABLE "FacturaCompra" ADD CONSTRAINT "FacturaCompra_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaCompra" ADD CONSTRAINT "FacturaCompra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "SocioNegocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaCompra" ADD CONSTRAINT "FacturaCompra_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaCompraLinea" ADD CONSTRAINT "FacturaCompraLinea_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "FacturaCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaCompraLinea" ADD CONSTRAINT "FacturaCompraLinea_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaCredito" ADD CONSTRAINT "NotaCredito_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "FacturaCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaCredito" ADD CONSTRAINT "NotaCredito_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaCreditoLinea" ADD CONSTRAINT "NotaCreditoLinea_notaCreditoId_fkey" FOREIGN KEY ("notaCreditoId") REFERENCES "NotaCredito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaCreditoLinea" ADD CONSTRAINT "NotaCreditoLinea_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
