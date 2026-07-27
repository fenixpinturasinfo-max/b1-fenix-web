-- AlterTable
ALTER TABLE "SolicitudReposicion" ADD COLUMN     "correlativo" INTEGER;

-- CreateIndex
CREATE INDEX "SolicitudReposicion_correlativo_idx" ON "SolicitudReposicion"("correlativo");
