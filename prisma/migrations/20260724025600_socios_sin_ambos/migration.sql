/*
  Warnings:

  - The values [AMBOS] on the enum `TipoSocio` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[rut,tipo]` on the table `SocioNegocio` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TipoSocio_new" AS ENUM ('CLIENTE', 'PROVEEDOR');
ALTER TABLE "SocioNegocio" ALTER COLUMN "tipo" TYPE "TipoSocio_new" USING ("tipo"::text::"TipoSocio_new");
ALTER TYPE "TipoSocio" RENAME TO "TipoSocio_old";
ALTER TYPE "TipoSocio_new" RENAME TO "TipoSocio";
DROP TYPE "public"."TipoSocio_old";
COMMIT;

-- DropIndex
DROP INDEX "SocioNegocio_rut_key";

-- CreateIndex
CREATE UNIQUE INDEX "SocioNegocio_rut_tipo_key" ON "SocioNegocio"("rut", "tipo");
