# Usuarios de prueba

Un equipo completo por local más los dos roles globales, para recorrer los 5 dashboards y
verificar que cada perfil ve solo lo suyo.

```bash
npx prisma migrate dev     # si aún no lo corriste: el rol GERENTE necesita su migración
npm run db:usuarios
```

Es idempotente. En cuentas que ya existen sincroniza nombre, rol, local y estado, pero **no
pisa la contraseña**. Para volver a dejarlas todas con la clave por defecto:

```bash
RESET=1 npm run db:usuarios
```

## Cuentas

Clave para todas: **`Fenix2026!`**

| Correo | Rol | Local | Qué probar |
|---|---|---|---|
| `admin@pinturasfenix.cl` | Administrador | Todos | Dashboard consolidado + panel "Salud del sistema". Único que ve Usuarios y Locales. |
| `gerente@pinturasfenix.cl` | Gerente | Todos | El mismo consolidado **sin** el panel de salud, y sin Usuarios ni Locales en el menú. |
| `jefe.sb@pinturasfenix.cl` | Encargado de Local | San Bernardo | Dashboard de sucursal. Al ser matriz, resuelve las solicitudes de todos los locales. En Inventario solo consulta stock y registra movimientos: sin botón "Editar" en la tabla. |
| `vendedor.sb@pinturasfenix.cl` | Vendedor | San Bernardo | Dashboard de caja con el botón grande. Solo POS. |
| `bodega.sb@pinturasfenix.cl` | Bodega | San Bernardo | Bandeja de pendientes arriba. Inventario y recepciones, sin POS. |
| `jefe.bu@pinturasfenix.cl` | Encargado de Local | Buin | Igual que el de San Bernardo, pero **sin** resolver solicitudes: su tarjeta dice "Solicitudes del local". |
| `vendedor.bu@pinturasfenix.cl` | Vendedor | Buin | Que no vea las ventas ni la caja de San Bernardo. |
| `bodega.bu@pinturasfenix.cl` | Bodega | Buin | Que su stock y sus quiebres sean solo los de Buin. |

## Casa matriz

El script marca **Fenix San Bernardo** como casa matriz. Sin una matriz definida, las
solicitudes de reposición no tienen destino y el dashboard del jefe de local no sabe quién
resuelve. Si prefieres que la matriz sea Buin, cambia `CODIGO_MATRIZ` en el script o hazlo
desde `/dashboard/locales`.

## Qué mirar en cada dashboard

Sugerencia de recorrido, porque las diferencias entre perfiles no se ven si la base está vacía:

1. **Vendedor SB** → abre caja y registra 2 o 3 ventas en el POS. El dashboard debería mostrar
   la caja abierta con el monto del turno y el ticket promedio.
2. **Bodega SB** → deja algún producto en cero (movimiento de merma). Debería aparecer la
   tarjeta roja "Sin stock" y llevar al inventario ya filtrado.
3. **Jefe SB** → verá la venta del vendedor, el quiebre del bodeguero y la caja abierta.
4. **Vendedor BU** → no debería ver nada de lo anterior.
5. **Gerente** → los dos locales en el semáforo, con San Bernardo con quiebres y Buin limpio.
6. **Admin** → lo mismo, más el panel de salud señalando los productos sin precio de costo.

## Antes de producción

Son cuentas de prueba con clave compartida y conocida. Desactívalas desde
`/dashboard/usuarios` antes de abrir el sistema al público, o bórralas de la base.
