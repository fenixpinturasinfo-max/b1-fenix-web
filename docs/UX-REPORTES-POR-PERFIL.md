# Reportes por perfil

> **Parcialmente implementado** (julio 2026). Listos: `Mi turno` (§2.1) y `Caja y descuadres`
> (§2.6), más el registro de movimientos de caja que faltaba en el modelo (§5.4).
> Pendientes: Ventas, Productos, Inventario y Compras.
>
> **Antes de correr**: `npx prisma migrate dev` — hay tres migraciones nuevas
> (`movimientos_de_caja`, `secciones_reportes`, `indices_caja_ventas`).
>
> Dónde vive: `features/pos/{caja,queries}.ts` · `features/pos/components/{LineaTiempoCaja,
> MovimientosCaja}.tsx` · `app/dashboard/reportes/{caja,mi-turno}/page.tsx`.

---

## 0. El principio

**Un reporte que no lleva a una acción es una planilla.** Hoy `/dashboard/reportes` es una
sola pantalla igual para todos: ventas de hoy, ventas del mes, top de productos y últimos
cierres de caja. Se mira, se asiente y se cierra. Nadie hace nada después de verla.

La diferencia entre un reporte y un tablero accionable es que cada fila termina en un enlace
que resuelve lo que el número acaba de revelar. "Laca HS lleva 90 días sin venderse" no sirve;
"Laca HS lleva 90 días sin venderse · $840.000 inmovilizados · **[Ver producto]**" sí.

**Persona por perfil**, y lo que cada uno viene a decidir:

| Perfil | Pregunta que trae | Decisión que toma |
|---|---|---|
| Vendedor | ¿Cómo voy hoy? | Cuánto le falta para su día normal |
| Bodega | ¿Qué se me está quebrando siempre? | Qué pedir y en qué cantidad |
| Encargado | ¿Mi local va bien y está cuadrado? | A quién apoyar, qué caja revisar |
| Gerente | ¿Qué local y qué categoría tira el mes? | Dónde meter plata y dónde cortar |

---

## 1. Arquitectura: cada reporte es una sección

Esta es la decisión de fondo, y aprovecha lo que acabamos de construir.

Hoy Reportes es **una** sección (`reportes.general`) con nivel Total o Sin acceso. La
propuesta es que **cada reporte sea su propia sección del catálogo**. Con eso:

- Quién ve qué reporte se configura desde Configuración › Perfiles, sin tocar código.
- Un reporte nuevo nace cerrado y se abre a conciencia, igual que cualquier sección.
- El menú, los guards y la vista previa del perfil funcionan sin cambios.
- "Solo lectura" no aplica: un reporte no se edita. Todas van con `permiteLectura: false`.

No hay que inventar un segundo sistema de permisos. El módulo Reportes pasa de 1 a 6 filas en
el catálogo y el resto sale gratis.

---

## 2. Catálogo propuesto

Seis reportes. Me resistí a hacer quince: cada uno tiene que ganarse el lugar respondiendo
una pregunta que alguien se hace de verdad.

### 2.1 `reportes.mi-desempeno` · Mi turno

**Pregunta:** ¿cómo voy hoy comparado con mi normal?

| | |
|---|---|
| Para | Vendedor, y cualquiera que venda |
| Alcance | Solo sus propias ventas |
| Datos | `Venta` filtrada por `usuarioId` · `CajaSesion` propias |

Contenido: ventas del día y del mes, ticket promedio, N.º de boletas, serie de 30 días, y sus
últimos cierres de caja con la diferencia. Comparación contra **su propio promedio de las
últimas 4 semanas**, no contra otros vendedores.

> **Nota deliberada.** El ranking nominal entre vendedores queda fuera de esta pantalla y solo
> aparece en la del encargado. Un tablero que le muestra a cada cajero su puesto frente a sus
> compañeros cambia la conducta de formas que rara vez son las buscadas —empuja a pelear
> clientes y a evitar los turnos flojos—. Que el encargado tenga el dato es distinto de
> publicarlo.

### 2.2 `reportes.ventas` · Ventas

**Pregunta:** ¿cómo vamos y de dónde viene la venta?

| | |
|---|---|
| Para | Encargado (su local) · Gerencia (consolidado y por local) |
| Datos | `Venta`, `DetalleVenta`, `Local`, `Usuario` |

Contenido: serie diaria del rango, ticket promedio, desglose por medio de pago, por vendedor
y —para gerencia— por local con su variación. **Ventas por hora del día** es el corte que más
sirve y que hoy no existe: define dotación de turnos.

**Acción por fila:** el vendedor lleva a sus boletas; el local, al detalle del local.

### 2.3 `reportes.productos` · Qué se vende y qué no

**Pregunta:** ¿qué repongo y qué dejo de comprar?

| | |
|---|---|
| Para | Encargado, Bodega, Gerencia |
| Datos | `DetalleVenta` + `Producto` + `StockLocal` |

Dos mitades, y la segunda es la que nadie tiene hoy:

- **Top** por monto, unidades y margen, en el rango elegido —con filtro de fecha, que el
  reporte actual no tiene: hoy el top es histórico de todos los tiempos.
- **Sin rotación**: productos con stock y sin ventas en 30/60/90 días, con el capital
  inmovilizado que representan. Es el reporte que devuelve plata.

**Acción por fila:** crear solicitud de reposición, o ir al producto para ajustar el precio.

### 2.4 `reportes.inventario` · Salud del inventario

**Pregunta:** ¿dónde se me está escapando el stock?

| | |
|---|---|
| Para | Bodega, Encargado, Gerencia |
| Datos | `MovimientoInventario`, `StockLocal`, `Producto` |

Contenido: quiebres recurrentes (cuántos días del mes estuvo cada producto en cero), mermas
por producto y por motivo, ajustes de conteo —que son la medida real de la exactitud del
inventario—, y valorización del stock por categoría.

**Acción por fila:** ir al producto, o registrar el movimiento que corresponda.

### 2.5 `reportes.compras` · Compras y proveedores

**Pregunta:** ¿qué proveedor me está fallando y cuánto debo?

| | |
|---|---|
| Para | Gerencia · Bodega en versión acotada (solo cumplimiento) |
| Datos | `OrdenCompra`, `EntradaCompra`, `FacturaCompra`, `NotaCredito` |

Contenido: cumplimiento de fecha por proveedor (días de atraso promedio), variación del precio
de compra respecto de la orden anterior, cuentas por pagar con su antigüedad, y notas de
crédito por proveedor —que son el termómetro de la calidad de las entregas.

**Acción por fila:** abrir la OC o la factura.

### 2.6 `reportes.caja` · Caja y descuadres

**Pregunta:** ¿quién y cuándo descuadra?

| | |
|---|---|
| Para | Encargado (su local), Gerencia |
| Datos | `CajaSesion` |

Contenido: cierres del rango con diferencia, acumulado por cajero y por local, y detección de
cajas que quedaron abiertas de días anteriores.

**Acción por fila:** abrir el turno y ver sus boletas.

> El total de diferencias se suma **en valor absoluto**. Dos descuadres de +5.000 y −5.000 no
> son "todo cuadra": son dos problemas.

---

## 3. Matriz por defecto

`T` = ve el reporte · `—` = no aparece. Editable después desde Perfiles.

| Reporte | Admin | Gerente | Encargado | Vendedor | Bodega |
|---|:--:|:--:|:--:|:--:|:--:|
| Mi turno | T | T | T | **T** | T |
| Ventas | T | T | T | — | — |
| Qué se vende y qué no | T | T | T | — | T |
| Salud del inventario | T | T | T | — | **T** |
| Compras y proveedores | T | T | — | — | **T** |
| Caja y descuadres | T | T | T | — | — |

El vendedor gana Reportes en el menú por primera vez, con una sola entrada: la suya.

---

## 4. Anatomía común

Todos los reportes comparten el mismo esqueleto, para que aprender uno sea aprender los seis.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Qué se vende y qué no                    [Hoy][7d][Mes][Mes ant.][📅] │  ← rango en la URL
│ Top del período y capital inmovilizado                                 │
├────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                    │
│ │ VENDIDO      │ │ SKUS CON     │ │ INMOVILIZADO │                    │  ← 3 KPIs, no 8
│ │ $28.4M       │ │ VENTA        │ │ $4.2M        │                    │
│ │ ▲ 6% vs mes  │ │ 214 de 340   │ │ 38 productos │                    │
│ └──────────────┘ └──────────────┘ └──────────────┘                    │
├────────────────────────────────────────────────────────────────────────┤
│ (Más vendidos)(Mayor margen)(Sin rotación)          [🔍 Buscar]        │  ← ChipsFiltro
│ ─────────────────────────────────────────────────────────────────────  │
│ PRODUCTO            CATEGORÍA   UNID.   VENDIDO   ÚLT. VENTA           │
│ Laca HS 1Lt         Pinturas       —         —    hace 94 días  [Ver→] │
│ Diluyente 5Lt       Solventes      —         —    hace 71 días  [Ver→] │
│                                                                        │
│                        1–10 de 38    ‹ 1 2 3 4 ›                       │
└────────────────────────────────────────────────────────────────────────┘
```

**Las reglas del esqueleto:**

1. **El título es la pregunta**, no el nombre de la tabla. "Qué se vende y qué no", no
   "Análisis de rotación de SKU".
2. **Máximo 3 KPIs.** Con ocho, ninguno se mira.
3. **Rango de fechas en la URL** (`?desde=&hasta=`), compartido por los seis reportes y
   recordado al navegar entre ellos. Un reporte sin período explícito miente por omisión.
4. **Chips para cambiar el corte**, no pestañas: es el mismo patrón de todas las listas del
   sistema.
5. **Cada fila termina en una acción.** Si una tabla no tiene columna de acción, hay que
   preguntarse por qué existe.
6. Tabla, buscador y paginación son los componentes que ya existen (`TablaScroll`,
   `BuscadorLista`, `ChipsFiltro`, `Paginacion`).

### Mi turno, para el vendedor

```
┌──────────────────────────────────────────────────────────┐
│ Mi turno                                Julio 2026       │
├──────────────────────────────────────────────────────────┤
│  HOY              MI PROMEDIO         ESTE MES           │
│  $284.500         $312.000            $3.9M              │
│  12 boletas       últimas 4 semanas   164 boletas        │
│                                                          │
│  Vas en 91% de tu día normal.                            │
├──────────────────────────────────────────────────────────┤
│  Mis ventas · últimos 30 días                            │
│      ╱╲    ╱╲                                            │
│  ╱╲╱  ╲╱╲╱  ╲___╱╲                                       │
├──────────────────────────────────────────────────────────┤
│  MIS CIERRES DE CAJA                                     │
│  26/07   $284.500 esperado   cuadrada         [Ver →]    │
│  25/07   $312.100 esperado   −$2.000          [Ver →]    │
└──────────────────────────────────────────────────────────┘
```

Sin ranking, sin comparación con otros. La referencia es su propio promedio.

---

## 5. Tres cosas que hay que resolver antes

### 5.1 🔴 El margen está inflado unos 19 puntos

`Producto.precioVenta` es precio final con IVA y `precioCosto` es neto. Todo margen calculado
entre ambos sale alto por el IVA completo. Ya lo mencioné cuando armamos el dashboard, y ahí
es un número al pasar; en un reporte de rentabilidad con el que se decide qué categoría
impulsar, es peor que no tenerlo.

Hay que decidir si el margen se expresa sobre venta neta (dividir por 1,19) o si se guarda el
precio de venta neto y el IVA aparte. Es una decisión de negocio, no técnica.

**Mientras no se resuelva:** el corte "Mayor margen" de §2.3 y el reporte de rentabilidad
quedan fuera, o el margen se rotula como estimado con la advertencia visible.

### 5.2 🟠 El top de productos actual no tiene filtro de fecha

`app/dashboard/reportes/page.tsx` agrupa `DetalleVenta` sin acotar el período: el "top del mes"
es en realidad el histórico completo. Se arregla al migrar, pero conviene saber que el número
que se está mirando hoy no es el que dice ser.

### 5.4 ✅ Faltaba registrar los movimientos de efectivo del turno

`CajaSesion` calculaba el esperado como apertura + ventas en efectivo, sin contemplar que
alguien saque plata para pagar un flete o haga una sangría de seguridad. Con varios turnos
al día eso deja de ser excepción: el arqueo marcaría rojos que no son descuadres y el equipo
aprendería a ignorarlos.

Resuelto con el modelo `MovimientoCaja` (sangría, gasto, ingreso), su registro desde el POS
y el recálculo del esperado en el cierre y en los reportes. Además se fijó una tolerancia
(`TOLERANCIA_DESCUADRE`, $1.000) compartida por el dashboard, el reporte de caja y la
pantalla de Reportes: tres definiciones distintas de "descuadre" en el mismo producto
destruían la credibilidad de la tolerancia más rápido de lo que el ruido destruía la del
arqueo.

### 5.3 🟠 Rendimiento de las consultas por rango

Un mes de ventas son unas 30.000 líneas de `DetalleVenta` con cuatro locales. Los reportes de
producto y margen necesitan `groupBy` con agregación en la base, no traer filas a memoria como
hace hoy `margenMes` en el dashboard. Con rangos de 3 meses o más, esto pasa de "lento" a
"se cae".

---

## 6. Orden de trabajo sugerido

1. Convertir Reportes de una sección a seis en el catálogo + migración de la matriz
2. Selector de rango compartido, con el estado en la URL
3. `Mi turno` — el más simple y el que estrena Reportes para el vendedor
4. `Caja y descuadres` — datos limpios, sin el problema del IVA
5. `Qué se vende y qué no` — el de mayor retorno, sin el corte de margen
6. `Salud del inventario`
7. `Ventas`, con el corte por hora del día
8. `Compras y proveedores`
9. El corte de margen, una vez resuelto §5.1

Los pasos 3 a 5 ya entregan valor solos. La pantalla actual se mantiene funcionando hasta que
`Ventas` la reemplace.

---

## 7. Checklist

- [x] Cada reporte responde una pregunta y termina en una acción
- [x] Permisos: reutiliza el sistema de secciones, sin inventar un segundo mecanismo
- [x] Alcance por local resuelto por `esRolGlobal`, igual que el resto del sistema
- [x] Consideración de conducta: sin ranking nominal entre vendedores en su propia pantalla
- [ ] Responsive: las tablas anchas necesitan definir qué columnas caen bajo `sm`
- [ ] Estados vacíos por reporte ("sin ventas en el período" ≠ "sin datos")
- [ ] **Abierto:** ¿el margen se expresa sobre venta neta? (§5.1)
- [ ] **Abierto:** ¿exportar a CSV desde el principio, o después? Hoy existe el patrón en
      `precios/export`, así que es barato agregarlo
