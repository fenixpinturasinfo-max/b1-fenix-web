# Dashboards por perfil — Diseño UX

> Estado: **implementado** (julio 2026). Enfoque: mixto (pendientes accionables arriba, KPIs abajo),
> sin librería de gráficos, los 5 perfiles.
>
> **Antes de correr el proyecto**: hay dos migraciones nuevas. Ejecutar `npx prisma migrate dev`
> (o `migrate deploy` + `npm run db:generate`). Hasta entonces el typecheck falla, porque el
> cliente Prisma generado no conoce `GERENTE` ni `DetalleVenta.costoUnitario`.
>
> Dónde vive: `features/dashboard/queries.ts` (datos), `features/dashboard/components/Dash*.tsx`
> (tableros), `app/dashboard/page.tsx` (despacho por rol), `components/ui/{KpiCard,TarjetaPendiente,
> Sparkline,BarrasComparativas,PanelDash,tonos}` (sistema), `lib/fechas.ts` (fechas chilenas).

---

## 0. Supuestos

- **Plataforma:** Next.js App Router, Server Components. Los dashboards se resuelven en el servidor; solo los gráficos interactivos (ninguno, por ahora) requerirían cliente.
- **Contexto de uso:** el POS y bodega se operan de pie, con pantalla compartida y a veces táctil. Gerencia se lee sentado, probablemente en notebook.
- **Frecuencia:** el vendedor y el bodeguero abren el dashboard 1–2 veces por turno (entrada y salida). El jefe de local, varias veces al día. Gerencia, una vez en la mañana.
- **Restricción de datos:** ver §6. Hay tres limitaciones del esquema que condicionan qué KPIs son honestos.

---

## 1. Personas

```
Nombre: Cajero de mostrador
Rol: Vendedor · turno de 8h
Meta: Abrir caja, vender rápido, cerrar cuadrado.
Frustración: Cualquier pantalla que no sea el POS le quita tiempo frente al cliente.
Comportamiento: Entra al sistema, mira si su caja está abierta, se va al POS y no vuelve.
Frase: "¿Cuánto llevo vendido hoy?"
Comodidad técnica: Baja-media
```

```
Nombre: Bodeguero
Rol: Bodega · recibe, cuenta, ajusta
Meta: Saber qué llega hoy y qué está por quebrar.
Frustración: Enterarse del quiebre cuando el vendedor ya perdió la venta.
Comportamiento: Revisa papeles de guía en mano; necesita la pantalla como checklist.
Frase: "¿Qué OC tengo pendiente de recibir?"
Comodidad técnica: Baja-media
```

```
Nombre: Encargado de local
Rol: Jefe de Local · responde por una sucursal
Meta: Cerrar el día cuadrado, sin quiebres y con los pedidos entregados.
Frustración: No tiene una vista única de su local; hoy debe entrar a 4 pantallas.
Comportamiento: Abre el sistema en la mañana y antes del cierre.
Frase: "¿Vamos mejor o peor que la semana pasada?"
Comodidad técnica: Media
```

```
Nombre: Gerente
Rol: Gerente · visión multi-local, sin configuración
Meta: Comparar locales, controlar compras y no pasarse en cuentas por pagar.
Frustración: Los números están, pero repartidos en Reportes, Compras y Facturas.
Frase: "¿Qué local está tirando el mes abajo?"
Comodidad técnica: Media-alta
```

```
Nombre: Administrador
Rol: Administrador · gerencia + salud del sistema
Meta: Todo lo del gerente, más detectar datos maestros mal cargados antes de que rompan un flujo.
Frustración: Un producto sin precio de costo ensucia todos los márgenes y nadie se entera.
Frase: "¿Está todo bien configurado?"
Comodidad técnica: Alta
```

---

## 2. Estructura común (design system del dashboard)

Cinco zonas. **Cada rol usa un subconjunto, y el orden vertical cambia según qué zona es la primaria para ese rol.**

| Zona | Nombre | Propósito | Regla |
|---|---|---|---|
| **Z1** | Barra de contexto personal | El estado que bloquea el trabajo del usuario ahora mismo | Solo si aplica al rol. Ocupa ancho completo, es la única con CTA primario. |
| **Z2** | Bandeja de pendientes | "Qué tengo que hacer" | Tarjetas con contador + CTA. **Una tarjeta con contador 0 no se renderiza.** Si todas están en 0 → estado vacío "Todo al día". |
| **Z3** | Franja de KPIs | "Cómo vamos" | 3–4 tarjetas compactas, con delta vs. periodo comparable. |
| **Z4** | Visualización | Tendencia y comparación | Sparkline 14 días y/o barras por local. SVG plano, sin librería. |
| **Z5** | Accesos rápidos | Navegación | Ya existe. Se mantiene al pie. |

### Jerarquía por rol

| Rol | Orden de zonas | Zona primaria |
|---|---|---|
| Vendedor | Z1 → Z3 → Z2 → Z4 | Z1 (su caja) |
| Bodega | Z2 → Z3 → Z4 | Z2 (pendientes) |
| Jefe de Local | Z1 → Z2 → Z3 → Z4 | Z2 |
| Gerente | Z3 → Z2 → Z4 | Z3 (KPIs) |
| Administrador | Z3 → Z2 → Z4 (+ salud) | Z3 |

**Racional:** el vendedor tiene una sola decisión (abrir caja / vender / cerrar), así que la zona primaria es un estado con un botón. El bodeguero y el jefe de local trabajan por excepción: lo primero debe ser la lista de anomalías. Gerencia lee tendencia primero y baja al detalle solo si un número se ve raro.

---

## 3. Matriz de KPIs y pendientes por rol

### Leyenda de alcance
`propio` = filtrado por `usuarioId` · `local` = filtrado por `session.localId` · `global` = todos los locales

| Métrica | Fuente | Vendedor | Bodega | Jefe Local | Gerente | Admin |
|---|---|---|---|---|---|---|
| **Z1 — Contexto** ||||||
| Estado de mi caja (abierta desde, vendido, n° boletas) | `CajaSesion` + `Venta` | ✅ propio | — | — | — | — |
| Cajas abiertas / diferencia acumulada del día | `CajaSesion` | — | — | ✅ local | — | — |
| **Z2 — Pendientes** ||||||
| Quiebres (cantidad = 0) | `StockLocal` | — | ✅ local | ✅ local | ✅ global | ✅ global |
| Stock bajo (0 < cantidad ≤ stockMin) | `StockLocal` | — | ✅ local | ✅ local | ✅ global | ✅ global |
| OC por recibir (ENVIADA, RECIBIDA_PARCIAL) | `OrdenCompra` | — | ✅ local | ✅ local | ✅ global | ✅ global |
| OC atrasadas (`fechaRequerida < hoy`, sin recibir) | `OrdenCompra` | — | ✅ local | ✅ local | ✅ global | ✅ global |
| Pedidos por preparar / entregar | `PedidoCliente` | ✅ local | — | ✅ local | ✅ global | ✅ global |
| Solicitudes pendientes de resolver | `SolicitudReposicion` | — | ✅ propias | ✅ local | ✅ global | ✅ global |
| Facturas vencidas / por vencer en 7 días | `FacturaCompra` | — | — | — | ✅ global | ✅ global |
| Cajas sin cerrar de días anteriores | `CajaSesion` | — | — | ✅ local | ✅ global | ✅ global |
| **Z3 — KPIs** ||||||
| Ventas hoy (monto + n° boletas) | `Venta` | ✅ propio | — | ✅ local | ✅ global | ✅ global |
| Δ vs. mismo día de la semana pasada | `Venta` | — | — | ✅ | ✅ | ✅ |
| Ticket promedio hoy | `Venta` | ✅ propio | — | ✅ local | ✅ global | ✅ global |
| Ventas del mes + Δ vs. mes anterior a la fecha | `Venta` | ✅ propio | — | ✅ local | ✅ global | ✅ global |
| Valor del inventario (Σ cantidad × precioCosto) | `StockLocal` × `Producto` | — | ✅ local | ✅ local | ✅ global | ✅ global |
| Movimientos de hoy | `MovimientoInventario` | — | ✅ local | — | — | — |
| Cuentas por pagar (Σ facturas ABIERTAS) | `FacturaCompra` | — | — | — | ✅ global | ✅ global |
| Margen estimado del mes ⚠️ | `DetalleVenta` × `Producto.precioCosto` | — | — | ✅ local | ✅ global | ✅ global |
| **Z4 — Visualización** ||||||
| Sparkline ventas 14 días | `Venta` | ✅ propio | — | ✅ local | ✅ global | ✅ global |
| Ranking de ventas por local (barras) | `Venta` | — | — | — | ✅ | ✅ |
| Semáforo operativo por local (tabla) | varias | — | — | — | ✅ | ✅ |
| Top 5 productos del mes | `DetalleVenta` | — | — | ✅ local | ✅ global | ✅ global |
| Últimos 5 movimientos | `MovimientoInventario` | — | ✅ local | — | — | — |
| **Extra Admin** ||||||
| Salud del maestro (productos sin costo, socios sin email, etc.) | varias | — | — | — | — | ✅ |

⚠️ **Margen estimado**: se calcula con el `precioCosto` **actual** del producto, no con el costo del momento de la venta (el esquema no guarda snapshot). Debe rotularse literalmente "estimado" en la UI y explicarse en el tooltip. Ver §6.3.

---

## 4. Wireframes

### 4.1 Vendedor — `/dashboard`

```
┌────────────────────────────────────────────────────────────────────┐
│ Hola, Camila · Fenix Melipilla                    Lun 27 jul, 10:42│
├────────────────────────────────────────────────────────────────────┤
│ ╔════════════════════════════════════════════════════════════════╗ │
│ ║ 🟢 CAJA ABIERTA desde las 09:15                                ║ │  ← Z1
│ ║                                                                 ║ │
│ ║    $284.500 vendidos  ·  12 boletas  ·  ticket $23.708         ║ │
│ ║                                                                 ║ │
│ ║    [  IR AL POS  ]              [ Cerrar caja ]                ║ │  ← CTA primario 56px
│ ╚════════════════════════════════════════════════════════════════╝ │
├────────────────────────────────────────────────────────────────────┤
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐             │
│ │ MIS VENTAS HOY│ │ TICKET PROM.  │ │ MI MES        │             │  ← Z3
│ │  $284.500     │ │  $23.708      │ │  $3.912.400   │             │
│ │  12 boletas   │ │  ▲ 8% vs ayer │ │  164 boletas  │             │
│ └───────────────┘ └───────────────┘ └───────────────┘             │
├────────────────────────────────────────────────────────────────────┤
│ ⚠️  3 pedidos esperando en tu local                    [ Ver → ]   │  ← Z2 (solo si >0)
├────────────────────────────────────────────────────────────────────┤
│ Mis ventas · últimos 14 días                                       │
│      ╱╲    ╱╲                                                      │  ← Z4 sparkline
│  ╱╲╱  ╲╱╲╱  ╲___╱╲                                                 │
├────────────────────────────────────────────────────────────────────┤
│ Accesos rápidos:  [ POS ]  [ Boletas ]                             │  ← Z5
└────────────────────────────────────────────────────────────────────┘
```

**Variante caja cerrada** — Z1 cambia de tono y de CTA:
```
╔══════════════════════════════════════════════════════════════════╗
║ ⚪ No tienes caja abierta                                        ║
║    Abre tu caja para empezar a vender.                           ║
║    [  ABRIR CAJA  ]                                              ║
╚══════════════════════════════════════════════════════════════════╝
```

- **Racional:** una sola decisión visible. El KPI existe pero no compite con el CTA.
- **Prioridad visual:** 1) estado de caja + botón, 2) cuánto llevo, 3) pedidos pendientes.
- **Táctil:** CTA primario de 56px de alto, el resto ≥44px.
- **Responsive:** KPIs 1 col en móvil, 3 desde `sm`.

---

### 4.2 Bodega — `/dashboard`

```
┌────────────────────────────────────────────────────────────────────┐
│ Hola, Jorge · Bodega Fenix Melipilla              Lun 27 jul, 08:10│
├────────────────────────────────────────────────────────────────────┤
│ PENDIENTES                                                          │  ← Z2 primaria
│ ┌──────────────────────┐ ┌──────────────────────┐                  │
│ │ 🔴  4                │ │ 🟠  17               │                  │
│ │ SIN STOCK            │ │ BAJO EL MÍNIMO       │                  │
│ │ Se están perdiendo   │ │ Conviene reponer     │                  │
│ │ ventas ahora         │ │ esta semana          │                  │
│ │ [ Ver productos → ]  │ │ [ Solicitar → ]      │                  │
│ └──────────────────────┘ └──────────────────────┘                  │
│ ┌──────────────────────┐ ┌──────────────────────┐                  │
│ │ 🔵  2                │ │ 🔵  5                │                  │
│ │ OC POR RECIBIR       │ │ MIS SOLICITUDES      │                  │
│ │ 1 atrasada           │ │ 3 ya cotizadas       │                  │
│ │ [ Registrar → ]      │ │ [ Ver estado → ]     │                  │
│ └──────────────────────┘ └──────────────────────┘                  │
├────────────────────────────────────────────────────────────────────┤
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐             │
│ │ VALOR STOCK   │ │ SKUS CON STOCK│ │ MOVIMIENTOS   │             │  ← Z3
│ │  $18.402.100  │ │  312 / 340    │ │  9 hoy        │             │
│ └───────────────┘ └───────────────┘ └───────────────┘             │
├────────────────────────────────────────────────────────────────────┤
│ Últimos movimientos                                    [ Ver todos ]│  ← Z4
│  08:02  ENTRADA      Laca HS 1Lt          +24   Jorge              │
│  07:55  AJUSTE       Diluyente 5Lt         −2   Jorge              │
│  …                                                                  │
├────────────────────────────────────────────────────────────────────┤
│ [ Registrar documento ]   [ Inventario ]   [ Compras ]              │  ← Z5
└────────────────────────────────────────────────────────────────────┘
```

- **Racional:** el bodeguero trabaja por excepción. Las 4 tarjetas de pendientes son su lista de tareas del turno; los KPIs son contexto secundario.
- **Interacción:** cada tarjeta lleva a la lista ya prefiltrada (`/dashboard/inventario?estado=quiebre`), no a la lista completa. Esto es lo que la convierte en accionable en vez de informativa.
- **Estado vacío:** si las 4 están en cero → una sola franja verde "Todo al día · sin quiebres ni recepciones pendientes" y los KPIs suben.

---

### 4.3 Jefe de Local — `/dashboard`

```
┌────────────────────────────────────────────────────────────────────┐
│ Fenix Melipilla                                   Lun 27 jul, 18:40│
├────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ 🟢 2 cajas abiertas · 1 cerrada hoy · diferencia acumulada $0   │ │  ← Z1
│ └────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────┤
│ PENDIENTES                                                          │  ← Z2
│ [🔴 4 sin stock] [🟠 17 bajo mín.] [🔵 2 OC por recibir]           │
│ [🟠 3 pedidos por entregar] [🔵 5 solicitudes por resolver]        │
├────────────────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│ │ VENTAS HOY │ │ TICKET PROM│ │ VENTAS MES │ │ MARGEN EST.│       │  ← Z3
│ │ $1.284.500 │ │  $24.230   │ │ $28.4M     │ │  31,2%     │       │
│ │ ▲12% vs    │ │ ▼3%        │ │ ▲6% vs mes │ │  estimado ⓘ│       │
│ │ lun pasado │ │            │ │ anterior   │ │            │       │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘       │
├───────────────────────────────────┬────────────────────────────────┤
│ Ventas · últimos 14 días          │ Top 5 del mes                  │  ← Z4
│        ╱╲      ╱╲                 │ 1 Laca HS 1Lt      $2.1M       │
│   ╱╲╱╲╱  ╲╱╲╱╲╱  ╲                │ 2 Diluyente 5Lt    $1.8M       │
│  ╱                 ╲              │ 3 Masilla plást.   $1.2M       │
│                                   │ …                              │
└───────────────────────────────────┴────────────────────────────────┘
```

- **Racional:** la comparación es contra **el mismo día de la semana pasada**, no contra ayer. Un lunes contra un domingo no dice nada en retail.
- **Prioridad:** cajas (bloquea el cierre del día) → excepciones → resultado → tendencia.

---

### 4.4 Gerente — `/dashboard`

```
┌────────────────────────────────────────────────────────────────────┐
│ Resumen consolidado · 4 locales                   Lun 27 jul, 09:05│
├────────────────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│ │ VENTAS HOY │ │ VENTAS MES │ │ TICKET PROM│ │ POR PAGAR  │       │  ← Z3 primaria
│ │ $4.128.900 │ │ $96.2M     │ │  $26.410   │ │ $14.8M     │       │
│ │ ▲9% vs lun │ │ ▲4% vs mes │ │ ▲2%        │ │ 3 vencidas │       │
│ │ pasado     │ │ anterior   │ │            │ │            │       │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘       │
├────────────────────────────────────────────────────────────────────┤
│ REQUIERE ATENCIÓN                                                   │  ← Z2
│ [🔴 3 facturas vencidas $2.1M] [🟠 5 vencen en 7 días]             │
│ [🟠 4 OC atrasadas] [🔵 12 solicitudes por resolver]               │
│ [🔴 1 caja sin cerrar de ayer — Fenix Talagante]                   │
├───────────────────────────────────┬────────────────────────────────┤
│ Ventas de hoy por local           │ Consolidado · 14 días          │  ← Z4
│ Melipilla   ████████████ $1.28M   │      ╱╲    ╱╲                  │
│ Talagante   ████████     $0.92M   │  ╱╲╱  ╲╱╲╱  ╲___╱╲             │
│ El Monte    ██████       $0.71M   │                                │
│ Peñaflor    ████         $0.48M   │                                │
├───────────────────────────────────┴────────────────────────────────┤
│ SEMÁFORO OPERATIVO                                                  │
│ LOCAL       VENTAS HOY   QUIEBRES  CAJAS  OC POR RECIBIR           │
│ Melipilla   $1.284.500      🔴 4    2 ab.       2                  │
│ Talagante     $920.100      🟢 0    1 ab.       0                  │
│ El Monte      $712.300      🟠 2    1 ab.       1                  │
│ Peñaflor      $483.900      🟢 0    0 ⚠️        3                  │
└────────────────────────────────────────────────────────────────────┘
```

- **Racional:** gerencia lee de arriba a abajo en 15 segundos. El semáforo operativo responde "¿qué local necesita una llamada?" sin abrir cuatro pantallas.
- **Interacción:** cada fila del semáforo enlaza al dashboard filtrado por ese local (requiere soportar `?local=` en las páginas destino).

---

### 4.5 Administrador

Idéntico al Gerente, más una sección al pie:

```
┌────────────────────────────────────────────────────────────────────┐
│ SALUD DEL SISTEMA                                                   │
│ ⚠️  12 productos activos sin precio de costo → distorsionan margen  │
│ ⚠️  3 proveedores sin correo → no se les puede pedir cotización     │
│ ⚠️  8 productos sin stock configurado en Peñaflor                   │
│ ✅  5 usuarios activos · 4 locales · 1 casa matriz                  │
└────────────────────────────────────────────────────────────────────┘
```

- **Racional:** son errores de datos maestros que rompen flujos silenciosamente. Nadie los busca; hay que mostrarlos.

---

## 5. Componentes nuevos a construir

Todos van a `components/ui/` salvo las consultas.

```
KpiCard
  Props: label, valor, sub?, delta?: {pct, direccion}, tono, icon?, href?, nota?
  Variantes: neutro | positivo | atencion | critico
  Estados: normal | sin datos ("—") | con enlace (hover)
  Usar: máximo 4 por franja.
  Evitar: deltas sin periodo de comparación explícito en el `sub`.

TarjetaPendiente
  Props: n, titulo, descripcion, href, cta, tono
  Regla: si n === 0 el componente devuelve null. La ausencia es la señal.
  Tonos: critico (rojo, pierde plata ahora) | atencion (naranja, esta semana) | info (azul, seguimiento)
  Accesibilidad: el tono nunca es la única señal — siempre icono + texto.

Sparkline
  Props: puntos: number[], ancho, alto, etiqueta
  SVG puro, sin estado, renderiza en servidor. Sin ejes ni tooltip: es contexto, no análisis.

BarrasComparativas
  Extraer el bloque que ya existe en app/dashboard/page.tsx (ventas por local).
  Props: items: {label, valor}[], formato

SeccionVacia
  Props: titulo, descripcion, icono
  Para "Todo al día".
```

**Helpers nuevos:**

```
lib/fechas.ts
  hoySantiago(): Date            // inicio del día en America/Santiago
  inicioMesSantiago(): Date
  hace(dias: number): Date
  mismoDiaSemanaPasada(): [inicio, fin]
  fmtFechaHora / fmtFecha / fmtFechaSola   // los 3 Intl que hoy están duplicados en 15 páginas

features/dashboard/queries.ts
  Una función por zona y rol, cada una recibiendo { rol, localId, usuarioId }.
  Cachear las de alcance global con unstable_cache + tag, siguiendo lib/cache.ts.
```

---

## 6. Bloqueadores — todos resueltos

### 6.1 ✅ Zona horaria — corregido en `lib/fechas.ts`

`app/dashboard/page.tsx` y `app/dashboard/reportes/page.tsx` hacen:

```ts
const hoy = new Date();
hoy.setHours(0, 0, 0, 0);
```

Eso usaba la hora **del servidor**. En Vercel el servidor está en UTC, así que "hoy" empezaba a las 20:00 hora de Chile **del día anterior** y las ventas de la tarde se contaban en el día equivocado.

`lib/fechas.ts` resuelve todo corte de fecha en `America/Santiago`, incluidos los dos días raros del año: el domingo de septiembre en que la medianoche no existe (el reloj salta de 24:00 a 01:00) y el sábado de abril de 25 horas. Se verificó que 365 días consecutivos quedan contiguos, sin duplicados ni huecos. Ya se aplicó también a `app/dashboard/reportes/page.tsx`, que tenía el mismo error.

### 6.2 ✅ `GERENTE` no existía — ni en el tipo ni en la base

Faltaba en la unión de `lib/auth/session.ts` **y en el enum de Postgres**: el schema lo declaraba pero ninguna migración lo había agregado, así que no se podía ni crear un gerente. Corregido en `lib/auth/session.ts` y en la migración `20260725190000_rol_gerente`.

### 6.3 ✅ Costo histórico en las líneas de venta

Se agregó `DetalleVenta.costoUnitario` (migración `20260725190100_detalle_venta_costo`, con backfill al costo actual) y el POS lo congela en cada venta. El margen del mes usa `Venta.total` como ingreso —la misma definición que el KPI de ventas que va al lado— y el costo congelado de las líneas.

Nota que sigue vigente: `precioVenta` es precio final con IVA y `precioCosto` es neto, así que el margen mostrado está inflado alrededor de 19 puntos. Corregirlo requiere decidir si el margen se expresa sobre venta neta.

### 6.4 🔵 Pendiente: rendimiento del margen

`margenMes` trae una fila por línea vendida en el mes (~30.000 a fin de mes con 4 locales). Funciona, pero convendría pasarlo a un `SUM(cantidad * costoUnitario)` en SQL. No lo hice porque no podía ejecutar SQL contra la base para verificarlo.

---

## 7. Checklist de entrega

- [x] Cada rol tiene un objetivo declarado y el layout lo sirve
- [x] Responsive: KPIs 1/2/4 columnas según breakpoint; pendientes 1 columna en móvil
- [x] Accesibilidad: el color nunca es la única señal (icono + texto en cada tono); CTA táctil ≥44px, el primario del POS a 56px; el orden del DOM sigue el orden de urgencia
- [x] Estado vacío definido ("Todo al día") y estado sin datos en KPI ("—")
- [ ] Estado de carga: `loading.tsx` ya existe pero muestra un spinner genérico → cambiar a skeletons con la forma real de las tarjetas
- [x] Copy accionable: cada pendiente dice qué pasa y qué hacer, no solo el número
- [x] Listas prefiltradas: inventario, OC, pedidos, facturas y solicitudes aceptan `?estado=`

---

## 8. Reglas de coherencia entre tarjeta y destino

Aprendidas corrigiendo la primera versión. Valen para cualquier tarjeta nueva.

1. **El contador debe medir lo mismo que la lista que abre.** Las solicitudes se guardan una fila por producto pero la lista muestra folios agrupados: el dashboard cuenta documentos, no líneas. Y como la lista marca `PARCIAL` los folios de estados mezclados, solo cuentan los íntegramente pendientes — que son los que el filtro muestra.
2. **Un delta parcial se compara contra un periodo parcial.** "Hoy" va de medianoche a *ahora*, así que la referencia de la semana pasada se recorta a la misma hora. Comparar 3 horas contra 24 pintaba una caída falsa toda la mañana.
3. **"Quiebre" significa algo distinto por local que consolidado.** La tarjeta de gerencia cuenta productos sin stock en *toda* la cadena (comprar), y el semáforo cuenta quiebres por local (transferir). Son decisiones distintas y por eso son dos números distintos.
4. **No mezclar definiciones de una misma magnitud en la misma franja.** El margen usa `Venta.total` porque el KPI de al lado usa `Venta.total`. Las cuentas por pagar restan notas de crédito tanto en el total como en el monto vencido.
5. **Los movimientos de bodega excluyen `SALIDA_VENTA`.** Esas las genera el POS solo; contarlas convertía el KPI en un contador de líneas vendidas disfrazado de carga de trabajo.
6. **Sumar descuadres de caja en valor absoluto.** Dos cajas con +5.000 y −5.000 no son "todo cuadra".
