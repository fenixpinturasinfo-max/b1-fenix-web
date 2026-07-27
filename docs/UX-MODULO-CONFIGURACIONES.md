# Módulo Configuraciones · Usuarios y Perfiles

> Estado: **implementado** (julio 2026). Permisos por sección del menú · los 5 perfiles
> actuales, editables · tres niveles: Total, Solo lectura y Sin acceso.
>
> **Antes de correr**: `npx prisma migrate dev`. La migración `20260727100000_permisos_por_perfil`
> crea la tabla y carga la matriz por defecto. Hasta entonces el typecheck falla porque el
> cliente generado no conoce `PermisoPerfil`.
>
> Dónde vive: `lib/auth/secciones.ts` (catálogo y matriz por defecto) · `lib/auth/permissions.ts`
> (resolución cacheada) · `lib/auth/guards.ts` (requireSeccion / exigirEscritura) ·
> `app/dashboard/configuracion/*` · `features/perfiles/*`.

---

## 0. Qué problema resuelve

Hoy los permisos viven en un objeto literal en `lib/auth/permissions.ts`. Cambiar qué ve un
perfil exige tocar código y desplegar. Ya pasó tres veces esta semana (precios de compra,
parámetros de inventario, entrada de mercadería), y cada vez el cambio quedó repartido entre
el menú, la página y la acción de servidor — con riesgo de que uno de los tres quede atrás.

La mejora mueve esa decisión a la base de datos y la concentra en una pantalla.

**Persona:** el administrador. No es desarrollador. Entra pocas veces al año, casi siempre
cuando entra alguien nuevo al equipo o cuando algo que un perfil no debía ver quedó visible.
Su miedo real es dejar a alguien sin poder trabajar un lunes a las 9 de la mañana, o peor,
quedarse él mismo fuera del sistema.

---

## 1. Los tres niveles

| Nivel | Qué hace el usuario | Qué ve en el menú |
|---|---|---|
| **Total** | Consulta y opera: crea, edita, anula | La sección aparece |
| **Solo lectura** | Consulta. Los botones de acción no se renderizan y las acciones de servidor rechazan | La sección aparece |
| **Sin acceso** | Nada. La ruta redirige al dashboard | La sección **no aparece** |

> **Nomenclatura.** Lo que en la conversación llamamos "restringido" quedó etiquetado como
> **"Sin acceso"**: "restringido" se lee como "acceso limitado" y alguien podría marcarlo
> creyendo que deja un acceso parcial. Es un error caro de detectar porque no falla —
> simplemente el usuario no encuentra la pantalla. Se cambia en `NIVELES`, en
> `lib/auth/secciones.ts`.

**No todas las secciones admiten los tres.** El POS en solo lectura no significa nada: o
vendes o no vendes. El catálogo de secciones declara qué niveles ofrece cada una, y la
pantalla solo muestra los aplicables.

### Lo que estos niveles NO controlan

El **alcance por local** —si el usuario ve todos los locales o solo el suyo— sigue dependiendo
del local asignado a su cuenta, no del perfil. Un encargado con acceso Total a Movimientos ve
los movimientos de su local, no los de toda la cadena.

Es deliberado: mezclar visibilidad y alcance en un solo control es la forma más rápida de
abrir datos de un local a otro sin darse cuenta. Si más adelante necesitas un "Supervisor de
zona" que vea tres locales, eso es una segunda dimensión y conviene diseñarla aparte.

---

## 2. Modelo de datos

Como los perfiles son los cinco existentes, **no hace falta una tabla `Perfil`**: basta con
una tabla de permisos indexada por el enum `Rol` que ya existe. Migración chica, sin tocar
`Usuario`.

```prisma
enum NivelAcceso {
  TOTAL
  LECTURA
  SIN_ACCESO
}

model PermisoPerfil {
  id      String      @id @default(cuid())
  rol     Rol
  /// Clave estable de la sección (catálogo en lib/auth/secciones.ts)
  seccion String
  nivel   NivelAcceso

  @@unique([rol, seccion])
  @@index([rol])
}
```

**El catálogo de secciones vive en código, no en la base.** Una sección es una ruta con una
pantalla detrás: si no existe el archivo, no existe la sección. Tenerlo en la base permitiría
crear filas fantasma que no llevan a ninguna parte y que nadie limpia nunca.

```ts
// lib/auth/secciones.ts
export interface Seccion {
  id: string;              // "compras.entradas"
  modulo: ModuloId;        // "compras"
  label: string;           // "Entrada mercadería"
  href: string;
  /// Qué se puede hacer aquí en solo lectura. Si es false, solo Total o Sin acceso.
  permiteLectura: boolean;
  /// Ayuda en la pantalla de perfiles: qué implica dar acceso
  descripcion: string;
}
```

**Resolución en runtime.** Un `unstable_cache` con tag `permisos` devuelve el mapa
`seccion → nivel` de un rol. Se invalida al guardar. El layout lo consulta una vez por
request para armar el menú; los guards lo consultan por página.

**Fallback.** Si un rol no tiene fila para una sección, el nivel es `SIN_ACCESO`. Es la
opción segura: una sección nueva nace cerrada y el administrador la abre a conciencia, en vez
de aparecer abierta para todos el día del despliegue.

---

## 3. Arquitectura de la información

```
Configuración            ← módulo nuevo
  ├─ Usuarios            ← /dashboard/configuracion/usuarios   (movido desde /dashboard/usuarios)
  ├─ Perfiles            ← /dashboard/configuracion/perfiles
  └─ Locales             ← /dashboard/configuracion/locales    (movido desde Inventario)
```

**Locales** salió de Inventario: crear una sucursal es configuración, se hace una vez al año.

**Redirecciones:** `/dashboard/usuarios` y `/dashboard/locales` redirigen a las rutas nuevas,
porque alguien las tiene en favoritos.

---

## 4. Catálogo de secciones

20 secciones en 6 módulos. La columna "Lectura" indica si ofrece el nivel intermedio.

| Módulo | Sección | Ruta | Lectura |
|---|---|---|---|
| **Inventario** | Productos | `/dashboard/inventario` | ✅ |
| | Registrar documento | `/dashboard/inventario/registrar` | ❌ |
| | Movimientos | `/dashboard/inventario/movimientos` | ✅ |
| | Precios de venta | `/dashboard/precios` | ✅ |
| | Precios de compra | `/dashboard/compras/precios` | ✅ |
| **Compras** | Solicitudes | `/dashboard/solicitudes` | ✅ |
| | Orden de compra | `/dashboard/compras` | ✅ |
| | Entrada mercadería | `/dashboard/compras/entradas` | ✅ |
| | Facturas de compra | `/dashboard/compras/facturas` | ✅ |
| | Notas de crédito | `/dashboard/compras/notas-credito` | ✅ |
| | Lista de partidas | `/dashboard/compras/partidas` | ✅ |
| **Ventas** | Pedidos | `/dashboard/ventas/pedidos` | ✅ |
| | POS | `/dashboard/pos` | ❌ |
| | Boletas | `/dashboard/pos/boletas` | ✅ |
| | Lista de partidas | `/dashboard/ventas/partidas` | ✅ |
| **Socios** | Socios de negocio | `/dashboard/socios` | ✅ |
| **Reportes** | Reportes | `/dashboard/reportes` | ✅ |
| **Configuración** | Usuarios | `/dashboard/configuracion/usuarios` | ✅ |
| | Perfiles | `/dashboard/configuracion/perfiles` | ✅ |
| | Locales | `/dashboard/configuracion/locales` | ✅ |

---

## 5. Matriz por defecto

Recoge el comportamiento actual más las tres decisiones de esta semana. Es lo que se cargará
en la migración; después todo es editable desde la pantalla.

`T` = Total · `L` = Solo lectura · `—` = Sin acceso

| Sección | Admin | Gerente | Encargado | Vendedor | Bodega |
|---|:--:|:--:|:--:|:--:|:--:|
| Inventario · Productos | T | T | **L** | — | L |
| Inventario · Registrar documento | T | T | T | — | T |
| Inventario · Movimientos | T | T | T | — | T |
| Inventario · Precios de venta | T | T | — | — | — |
| Inventario · Precios de compra | T | T | **—** | — | **—** |
| Compras · Solicitudes | T | T | T | — | T |
| Compras · Orden de compra | T | T | **—** | — | L |
| Compras · **Entrada mercadería** | T | T | **T** | — | T |
| Compras · Facturas de compra | T | T | **—** | — | — |
| Compras · Notas de crédito | T | T | **—** | — | — |
| Compras · Lista de partidas | T | T | **—** | — | L |
| Ventas · Pedidos | T | T | T | T | — |
| Ventas · POS | T | T | T | T | — |
| Ventas · Boletas | T | T | T | T | — |
| Ventas · Lista de partidas | T | T | T | L | — |
| Socios de negocio | T | T | — | — | — |
| Reportes | T | T | T | — | — |
| Configuración · Usuarios | T | — | — | — | — |
| Configuración · Perfiles | T | — | — | — | — |
| Configuración · Locales | T | — | — | — | — |

En **negrita** lo que cambia respecto de hoy: el encargado queda con Compras reducido a
Entrada mercadería, y Productos en solo lectura.

**Punto a confirmar:** el encargado pierde **Solicitudes** de reposición si aplicamos
literalmente "Compras solo Entrada mercadería". Pero el encargado de la casa matriz es hoy
quien **resuelve** las solicitudes de todos los locales, y el dashboard que acabamos de armar
cuenta con eso. En la tabla lo dejé en `T`; si de verdad debe perderlo, hay que rediseñar
quién resuelve las reposiciones.

---

## 6. Pantalla de Perfiles

### 6.1 Listado

```
┌──────────────────────────────────────────────────────────────────────┐
│ Perfiles                                                             │
│ Qué puede ver y hacer cada tipo de cuenta.                           │
├──────────────────────────────────────────────────────────────────────┤
│ PERFIL           USUARIOS   ACCESO                                   │
│ ─────────────────────────────────────────────────────────────────────│
│ Administrador       1       Todo el sistema            🔒 [ Ver ]    │
│ Gerente             1       17 de 21 secciones            [ Editar ] │
│ Encargado de Local  2       9 de 21 · 1 solo lectura      [ Editar ] │
│ Vendedor            2       4 de 21                       [ Editar ] │
│ Bodega              2       8 de 21 · 2 solo lectura      [ Editar ] │
└──────────────────────────────────────────────────────────────────────┘
```

- **Racional:** la columna "Usuarios" es lo primero que se necesita saber. Cambiar el perfil
  Vendedor sin saber que afecta a dos personas es cómo se rompe un turno.
- El administrador aparece con candado y sin editar. Ver §6.4.

### 6.2 Editor de un perfil

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Perfiles                                                           │
│ Encargado de Local                    2 usuarios con este perfil     │
│ Camila Rojas · Pedro Soto                                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  INVENTARIO                        aplicar a todo: [T] [L] [—]       │
│  ─────────────────────────────────────────────────────────────────── │
│  Productos                         ( Total )(•Lectura•)(  —  )       │
│    Stock, mínimos y ficha del producto                               │
│  Registrar documento               (•Total •)          (  —  )       │
│    Entradas, mermas, ajustes y transferencias                        │
│  Movimientos                       (•Total •)( Lectura )(  —  )      │
│    Historial de todo lo que entró y salió                            │
│  Precios de venta                  ( Total )( Lectura )(• — •)       │
│  Precios de compra                 ( Total )( Lectura )(• — •)       │
│  Locales                           ( Total )( Lectura )(• — •)       │
│                                                                       │
│  COMPRAS                           aplicar a todo: [T] [L] [—]       │
│  ─────────────────────────────────────────────────────────────────── │
│  Solicitudes                       (•Total •)( Lectura )(  —  )      │
│  Orden de compra                   ( Total )( Lectura )(• — •)       │
│  Entrada mercadería                (•Total •)( Lectura )(  —  )      │
│  ...                                                                  │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│ 3 cambios sin guardar          [ Descartar ]  [ Guardar cambios ]    │  ← barra fija
└──────────────────────────────────────────────────────────────────────┘
```

**Decisiones de interacción**

- **Segmented control de 3 estados por fila**, no tres checkboxes. Los niveles son mutuamente
  excluyentes y el control debe decirlo. Con checkboxes siempre existe el estado imposible de
  "lectura + sin acceso".
- **Las filas sin `permiteLectura` muestran solo dos opciones**, con el hueco visible. Es
  preferible a ofrecer un botón deshabilitado que el usuario intenta apretar dos veces.
- **La descripción va bajo el nombre**, no en un tooltip. "Registrar documento" no le dice
  nada a quien no armó el sistema, y un tooltip obliga a descubrir que existe.
- **Atajo por módulo**: poner los 6 ítems de Compras en "—" de a uno es tedioso y propenso a
  dejar uno abierto por descuido.
- **Guardado explícito con barra fija y contador de cambios.** El autoguardado en una pantalla
  de permisos es peligroso: un clic accidental deja a alguien fuera sin que nadie se entere.
- **Salir con cambios pendientes pide confirmación**, igual que los modales del sistema.

**Prioridad visual:** 1) de qué perfil se trata y a quiénes afecta, 2) qué está abierto hoy,
3) el control para cambiarlo.

**Responsive:** bajo `sm` el segmented control pasa a ancho completo debajo del nombre de la
sección, y la barra de guardado se ancla al borde inferior de la ventana.

### 6.3 Confirmación al guardar

```
┌────────────────────────────────────────────────┐
│ Guardar cambios en Encargado de Local          │
│                                                │
│ Afecta a 2 usuarios activos.                   │
│                                                │
│ Pierden acceso a:                              │
│   · Orden de compra                            │
│   · Facturas de compra                         │
│ Pasan a solo lectura:                          │
│   · Productos                                  │
│                                                │
│ Los cambios se aplican de inmediato, incluso   │
│ para quienes tengan la sesión abierta.         │
│                                                │
│      [ Cancelar ]   [ Guardar cambios ]        │
└────────────────────────────────────────────────┘
```

Mostrar el diff en palabras, no un "¿estás seguro?". El usuario acaba de hacer diez clics y
no necesariamente recuerda todos. Los accesos que se **quitan** van primero: son los que
rompen el trabajo de alguien.

### 6.4 Protecciones contra quedarse fuera

Es el riesgo real de esta pantalla. Tres capas:

1. **El perfil Administrador no es editable.** Tiene Total en todo, siempre, incluidas las
   secciones que se agreguen en el futuro. Es la llave maestra: si se pudiera restringir, un
   error deja el sistema sin nadie que pueda arreglarlo.
2. **Configuración · Perfiles solo se abre a perfiles que ya la tengan.** Aunque el
   administrador es la garantía, el servidor valida igual.
3. **No puedes editar tu propio perfil.** Si mañana existe un segundo perfil con acceso a
   Configuración, esta regla evita el autobloqueo. Mensaje: *"No puedes cambiar los permisos
   del perfil que estás usando. Pídeselo a otro administrador."*

### 6.5 Estados

- **Vacío:** no aplica, siempre hay 5 perfiles.
- **Sin usuarios:** *"Ningún usuario tiene este perfil todavía"* en gris, en vez de "0".
- **Guardando:** botón en "Guardando…", controles deshabilitados.
- **Error:** el error va sobre la barra de guardado, no arriba de todo: es donde está mirando.
- **Éxito:** confirmación breve y el contador de cambios vuelve a cero, sin salir de la
  pantalla — normalmente se ajustan varios módulos seguidos.

---

## 7. Implementación

### 7.1 Capa de permisos

`lib/auth/permissions.ts` cambia de objeto literal a consulta cacheada:

```ts
export type Nivel = "TOTAL" | "LECTURA" | "SIN_ACCESO";

/** Mapa sección → nivel del rol. Cacheado con tag "permisos". */
export const permisosDe = unstable_cache(
  async (rol: string): Promise<Record<string, Nivel>> => { ... },
  ["permisos-perfil"],
  { tags: ["permisos"], revalidate: 3600 },
);

export async function nivelDe(rol: string, seccion: string): Promise<Nivel>;
export async function puedeVer(rol: string, seccion: string): Promise<boolean>;
export async function puedeEscribir(rol: string, seccion: string): Promise<boolean>;
```

El administrador se resuelve **antes** de tocar la base: `if (rol === "ADMINISTRADOR") return "TOTAL"`.
Así la llave maestra no depende de que existan filas.

### 7.2 Guards

```ts
/** Exige sesión y que la sección esté visible; si no, redirige. */
export async function requireSeccion(seccion: string): Promise<SessionPayload>;

/** Igual, pero además devuelve si puede escribir, para renderizar la UI. */
export async function requireSeccionConNivel(seccion: string):
  Promise<{ session: SessionPayload; puedeEscribir: boolean }>;
```

Reemplazan a `requireModulo` en las 21 páginas. `requireModulo` se mantiene como envoltorio
deprecado durante la migración para no romper nada a medio camino.

### 7.3 Las acciones de servidor son el permiso de verdad

Ocultar el botón no es seguridad. Cada Server Action que muta debe empezar con
`await exigirEscritura("compras.entradas")`. Es la parte más tediosa y la que no se puede
saltar: hay ~30 acciones repartidas en `features/*/actions.ts`.

Esta es la razón por la que el trabajo no es "una pantalla más": la pantalla es el 20%.

### 7.4 Menú

`app/dashboard/layout.tsx` deja de tener la estructura escrita a mano y la deriva del catálogo
de secciones filtrado por permisos. Un módulo cuyas secciones estén todas en "sin acceso" no
renderiza ni su encabezado.

### 7.5 Orden de trabajo

1. Migración: enum, tabla y carga de la matriz por defecto
2. `lib/auth/secciones.ts` + capa de permisos cacheada
3. Guards nuevos y menú derivado
4. Migrar las 21 páginas de `requireModulo` a `requireSeccion`
5. Cerrar las ~30 acciones de servidor con `exigirEscritura`
6. Pantalla de Perfiles
7. Mover Usuarios a Configuración + redirección de la ruta vieja
8. Verificación: recorrer los 5 perfiles con las cuentas de prueba

Los pasos 1–5 no cambian nada visible: dejan el sistema igual pero gobernado por la base.
El 6 es el que se ve.

---

## 8. Checklist

- [x] Objetivo del administrador servido: una pantalla en vez de tres archivos
- [x] Responsive definido para el editor
- [x] Accesibilidad: segmented control con `role="radiogroup"`, navegable por teclado,
      el estado nunca depende solo del color (texto en cada opción)
- [x] Edge cases: perfil sin usuarios, sección sin nivel de lectura, autobloqueo
- [x] Copy: descripción por sección, diff en palabras al confirmar
- [x] Locales se movió a Configuración, con redirección desde la ruta vieja
- [x] El encargado conserva Solicitudes en la matriz por defecto. Ya es configurable.
- [x] La etiqueta quedó como "Sin acceso"
