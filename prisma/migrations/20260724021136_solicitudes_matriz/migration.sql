-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE', 'DESPACHADA', 'RECHAZADA');

-- AlterTable
ALTER TABLE "Local" ADD COLUMN     "esMatriz" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SolicitudReposicion" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "nota" TEXT,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
    "solicitanteId" TEXT NOT NULL,
    "resueltoPorId" TEXT,
    "notaResolucion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltoEn" TIMESTAMP(3),

    CONSTRAINT "SolicitudReposicion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitudReposicion_estado_creadoEn_idx" ON "SolicitudReposicion"("estado", "creadoEn");

-- CreateIndex
CREATE INDEX "SolicitudReposicion_localId_idx" ON "SolicitudReposicion"("localId");

-- AddForeignKey
ALTER TABLE "SolicitudReposicion" ADD CONSTRAINT "SolicitudReposicion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudReposicion" ADD CONSTRAINT "SolicitudReposicion_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudReposicion" ADD CONSTRAINT "SolicitudReposicion_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudReposicion" ADD CONSTRAINT "SolicitudReposicion_resueltoPorId_fkey" FOREIGN KEY ("resueltoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
