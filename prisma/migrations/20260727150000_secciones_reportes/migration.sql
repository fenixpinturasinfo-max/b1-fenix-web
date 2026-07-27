-- Reportes deja de ser una sección única: cada reporte es su propia sección,
-- así quién ve cuál se configura desde Configuración › Perfiles sin tocar código.
-- El vendedor estrena Reportes con una sola entrada: la suya.
INSERT INTO "PermisoPerfil" ("id", "rol", "seccion", "nivel") VALUES
  (gen_random_uuid()::text, 'GERENTE', 'reportes.mi-turno', 'TOTAL'),
  (gen_random_uuid()::text, 'GERENTE', 'reportes.caja', 'TOTAL'),
  (gen_random_uuid()::text, 'JEFE_LOCAL', 'reportes.mi-turno', 'TOTAL'),
  (gen_random_uuid()::text, 'JEFE_LOCAL', 'reportes.caja', 'TOTAL'),
  (gen_random_uuid()::text, 'VENDEDOR', 'reportes.mi-turno', 'TOTAL')
ON CONFLICT ("rol", "seccion") DO NOTHING;
