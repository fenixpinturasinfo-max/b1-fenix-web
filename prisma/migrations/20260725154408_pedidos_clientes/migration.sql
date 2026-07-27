-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('PENDIENTE', 'PREPARADO', 'ENTREGADO', 'ANULADO');

-- CreateTable
CREATE TABLE "PedidoCliente" (
    "id" TEXT NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "clienteId" TEXT,
    "nombreCliente" TEXT NOT NULL,
    "telefono" TEXT,
    "localId" TEXT NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'PENDIENTE',
    "nota" TEXT,
    "total" INTEGER NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregadoEn" TIMESTAMP(3),

    CONSTRAINT "PedidoCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoClienteLinea" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,

    CONSTRAINT "PedidoClienteLinea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PedidoCliente_correlativo_key" ON "PedidoCliente"("correlativo");

-- CreateIndex
CREATE INDEX "PedidoCliente_estado_creadoEn_idx" ON "PedidoCliente"("estado", "creadoEn");

-- CreateIndex
CREATE INDEX "PedidoCliente_localId_idx" ON "PedidoCliente"("localId");

-- CreateIndex
CREATE INDEX "PedidoClienteLinea_pedidoId_idx" ON "PedidoClienteLinea"("pedidoId");

-- AddForeignKey
ALTER TABLE "PedidoCliente" ADD CONSTRAINT "PedidoCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "SocioNegocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCliente" ADD CONSTRAINT "PedidoCliente_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCliente" ADD CONSTRAINT "PedidoCliente_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoClienteLinea" ADD CONSTRAINT "PedidoClienteLinea_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoClienteLinea" ADD CONSTRAINT "PedidoClienteLinea_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
