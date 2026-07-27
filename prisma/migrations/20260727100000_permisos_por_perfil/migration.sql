-- Permisos por perfil, editables desde Configuración › Perfiles.
-- Reemplazan la matriz que hasta ahora vivía fija en lib/auth/permissions.ts.

CREATE TYPE "NivelAcceso" AS ENUM ('TOTAL', 'LECTURA', 'SIN_ACCESO');

CREATE TABLE "PermisoPerfil" (
    "id" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "seccion" TEXT NOT NULL,
    "nivel" "NivelAcceso" NOT NULL,

    CONSTRAINT "PermisoPerfil_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PermisoPerfil_rol_idx" ON "PermisoPerfil"("rol");
CREATE UNIQUE INDEX "PermisoPerfil_rol_seccion_key" ON "PermisoPerfil"("rol", "seccion");

-- Matriz por defecto: reproduce el comportamiento vigente al momento de la migración.
-- ADMINISTRADOR no se carga a propósito: siempre tiene TOTAL, resuelto en código, para que
-- la llave maestra no dependa de que existan filas.
-- Sin fila para (rol, sección) el nivel es SIN_ACCESO: lo nuevo nace cerrado.
INSERT INTO "PermisoPerfil" ("id", "rol", "seccion", "nivel") VALUES
  (gen_random_uuid()::text, 'GERENTE', 'inventario.productos', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'inventario.registrar', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'inventario.movimientos', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'inventario.precios-venta', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'inventario.precios-compra', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'compras.solicitudes', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'compras.ordenes', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'compras.entradas', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'compras.facturas', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'compras.notas-credito', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'compras.partidas', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'ventas.pedidos', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'ventas.pos', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'ventas.boletas', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'ventas.partidas', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'socios.socios', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'reportes.general', 'TOTAL'),
  (gen_random_uuid()::text, 'JEFE_LOCAL', 'inventario.productos', 'LECTURA'),
  (gen_random_uuid()::text, 'JEFE_LOCAL', 'inventario.registrar', 'TOTAL'),
  (gen_random_uuid()::text, 'JEFE_LOCAL', 'inventario.movimientos', 'TOTAL'),
  (gen_random_uuid()::text, 'JEFE_LOCAL', 'compras.solicitudes', 'TOTAL'),
  (gen_random_uuid()::text, 'JEFE_LOCAL', 'compras.entradas', 'TOTAL'),
  (gen_random_uuid()::text, 'JEFE_LOCAL', 'ventas.pedidos', 'TOTAL'),
  (gen_random_uuid()::text, 'JEFE_LOCAL', 'ventas.pos', 'TOTAL'),
  (gen_random_uuid()::text, 'JEFE_LOCAL', 'ventas.boletas', 'TOTAL'),
  (gen_random_uuid()::text, 'JEFE_LOCAL', 'ventas.partidas', 'TOTAL'),
  (gen_random_uuid()::text, 'JEFE_LOCAL', 'reportes.general', 'TOTAL'),
  (gen_random_uuid()::text, 'VENDEDOR', 'ventas.pedidos', 'TOTAL'),
  (gen_random_uuid()::text, 'VENDEDOR', 'ventas.pos', 'TOTAL'),
  (gen_random_uuid()::text, 'VENDEDOR', 'ventas.boletas', 'TOTAL'),
  (gen_random_uuid()::text, 'VENDEDOR', 'ventas.partidas', 'LECTURA'),
  (gen_random_uuid()::text, 'BODEGA', 'inventario.productos', 'TOTAL'),
  (gen_random_uuid()::text, 'BODEGA', 'inventario.registrar', 'TOTAL'),
  (gen_random_uuid()::text, 'BODEGA', 'inventario.movimientos', 'TOTAL'),
  (gen_random_uuid()::text, 'BODEGA', 'compras.solicitudes', 'TOTAL'),
  (gen_random_uuid()::text, 'BODEGA', 'compras.ordenes', 'LECTURA'),
  (gen_random_uuid()::text, 'BODEGA', 'compras.entradas', 'TOTAL'),
  (gen_random_uuid()::text, 'BODEGA', 'compras.partidas', 'LECTURA');
