-- CreateTable
CREATE TABLE "EmailBoleta" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "enviadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailBoleta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailBoleta_enviadoEn_idx" ON "EmailBoleta"("enviadoEn");
