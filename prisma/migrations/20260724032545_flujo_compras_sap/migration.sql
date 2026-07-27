-- AlterTable
ALTER TABLE "SolicitudReposicion" ADD COLUMN     "ordenCompraId" TEXT;

-- AddForeignKey
ALTER TABLE "SolicitudReposicion" ADD CONSTRAINT "SolicitudReposicion_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;
