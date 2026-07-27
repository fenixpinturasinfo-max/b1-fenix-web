-- CreateEnum
CREATE TYPE "TipoSocio" AS ENUM ('CLIENTE', 'PROVEEDOR', 'AMBOS');

-- CreateEnum
CREATE TYPE "DestinoSolicitud" AS ENUM ('MATRIZ', 'PROVEEDOR');

-- CreateEnum
CREATE TYPE "EstadoOC" AS ENUM ('BORRADOR', 'ENVIADA', 'RECIBIDA_PARCIAL', 'RECIBIDA', 'CERRADA', 'ANULADA');

-- AlterTable
ALTER TABLE "SolicitudReposicion" ADD COLUMN     "destino" "DestinoSolicitud" NOT NULL DEFAULT 'MATRIZ',
ADD COLUMN     "proveedorId" TEXT;

-- CreateTable
CREATE TABLE "SocioNegocio" (
    "id" TEXT NOT NULL,
    "tipo" "TipoSocio" NOT NULL,
    "rut" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreFantasia" TEXT,
    "giro" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "comuna" TEXT,
    "condicionPago" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocioNegocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenCompra" (
    "id" TEXT NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "localDestinoId" TEXT NOT NULL,
    "estado" "EstadoOC" NOT NULL DEFAULT 'ENVIADA',
    "nota" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrdenCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenCompraLinea" (
    "id" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costoUnitario" INTEGER NOT NULL,
    "cantidadRecibida" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrdenCompraLinea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntradaCompra" (
    "id" TEXT NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "ordenCompraId" TEXT,
    "proveedorId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "numeroGuia" TEXT,
    "recibidoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntradaCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntradaCompraLinea" (
    "id" TEXT NOT NULL,
    "entradaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costoUnitario" INTEGER NOT NULL,

    CONSTRAINT "EntradaCompraLinea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocioNegocio_rut_key" ON "SocioNegocio"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompra_correlativo_key" ON "OrdenCompra"("correlativo");

-- CreateIndex
CREATE INDEX "OrdenCompra_estado_creadoEn_idx" ON "OrdenCompra"("estado", "creadoEn");

-- CreateIndex
CREATE INDEX "OrdenCompraLinea_ordenCompraId_idx" ON "OrdenCompraLinea"("ordenCompraId");

-- CreateIndex
CREATE UNIQUE INDEX "EntradaCompra_correlativo_key" ON "EntradaCompra"("correlativo");

-- CreateIndex
CREATE INDEX "EntradaCompra_creadoEn_idx" ON "EntradaCompra"("creadoEn");

-- CreateIndex
CREATE INDEX "EntradaCompraLinea_entradaId_idx" ON "EntradaCompraLinea"("entradaId");

-- AddForeignKey
ALTER TABLE "SolicitudReposicion" ADD CONSTRAINT "SolicitudReposicion_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "SocioNegocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "SocioNegocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_localDestinoId_fkey" FOREIGN KEY ("localDestinoId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompraLinea" ADD CONSTRAINT "OrdenCompraLinea_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompraLinea" ADD CONSTRAINT "OrdenCompraLinea_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntradaCompra" ADD CONSTRAINT "EntradaCompra_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntradaCompra" ADD CONSTRAINT "EntradaCompra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "SocioNegocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntradaCompra" ADD CONSTRAINT "EntradaCompra_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntradaCompra" ADD CONSTRAINT "EntradaCompra_recibidoPorId_fkey" FOREIGN KEY ("recibidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntradaCompraLinea" ADD CONSTRAINT "EntradaCompraLinea_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES "EntradaCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntradaCompraLinea" ADD CONSTRAINT "EntradaCompraLinea_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
