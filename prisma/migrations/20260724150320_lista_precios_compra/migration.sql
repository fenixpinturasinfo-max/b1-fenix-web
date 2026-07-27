-- CreateTable
CREATE TABLE "PrecioCompraProveedor" (
    "id" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "precio" INTEGER NOT NULL,
    "origen" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrecioCompraProveedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrecioCompraProveedor_productoId_idx" ON "PrecioCompraProveedor"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "PrecioCompraProveedor_proveedorId_productoId_key" ON "PrecioCompraProveedor"("proveedorId", "productoId");

-- AddForeignKey
ALTER TABLE "PrecioCompraProveedor" ADD CONSTRAINT "PrecioCompraProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "SocioNegocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioCompraProveedor" ADD CONSTRAINT "PrecioCompraProveedor_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
