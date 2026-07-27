-- El enum Rol del schema ya contempla GERENTE, pero la base nunca lo recibió.
-- Sin esto no se puede crear un gerente ni enrutar su dashboard.
ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'GERENTE' AFTER 'ADMINISTRADOR';
