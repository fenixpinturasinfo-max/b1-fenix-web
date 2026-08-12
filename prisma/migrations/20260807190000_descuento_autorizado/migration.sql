-- Descuento sobre el total, con quién lo autorizó.
--
-- Hasta acá el descuento existía en la boleta del POS pero nadie respondía por él. Ahora
-- toda rebaja queda con nombre: el del supervisor que tecleó su clave en el mesón, o el
-- del propio cajero cuando el monto cupo en el tramo libre de su perfil.
--
-- `descuentoAutorizadoPorId` queda en SET NULL a propósito. Desactivar a un usuario no
-- borra su fila, así que en la práctica no se pierde el rastro; pero si algún día alguien
-- se borra de verdad, es preferible una venta con el autorizador en blanco que una venta
-- que no se puede borrar ni consultar.

ALTER TABLE "Venta" ADD COLUMN "descuentoAutorizadoPorId" TEXT;
ALTER TABLE "Venta" ADD COLUMN "descuentoMotivo" TEXT;

-- La factura no tenía descuento. Parte en 0: las ya emitidas no cambian de total.
ALTER TABLE "FacturaVenta" ADD COLUMN "descuento" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FacturaVenta" ADD COLUMN "descuentoAutorizadoPorId" TEXT;
ALTER TABLE "FacturaVenta" ADD COLUMN "descuentoMotivo" TEXT;

ALTER TABLE "Venta"
    ADD CONSTRAINT "Venta_descuentoAutorizadoPorId_fkey"
    FOREIGN KEY ("descuentoAutorizadoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FacturaVenta"
    ADD CONSTRAINT "FacturaVenta_descuentoAutorizadoPorId_fkey"
    FOREIGN KEY ("descuentoAutorizadoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Tramo libre por perfil. La tabla nace vacía y sin fila el tramo es cero: al terminar la
-- migración todos los perfiles piden autorización, y desde Configuración › Perfiles se
-- abre el que corresponda. Lo contrario —repartir topes por defecto— sería regalar plata
-- en la madrugada del deploy.
CREATE TABLE "TopeDescuento" (
    "rol" "Rol" NOT NULL,
    "porcentaje" INTEGER NOT NULL DEFAULT 0,
    "montoMaximo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TopeDescuento_pkey" PRIMARY KEY ("rol")
);
