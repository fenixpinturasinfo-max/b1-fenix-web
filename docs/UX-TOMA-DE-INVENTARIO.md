# Toma de inventario

> Propuesta para validar. Perfil principal: Bodega. Aprobación: Encargado o Gerencia.

---

## 0. Lo que hay hoy no es una toma de inventario

`/dashboard/inventario/registrar` permite un movimiento de tipo AJUSTE: un producto, una
cantidad, un motivo. Eso es una **corrección puntual** — "conté las lacas y faltaban 2".

Una toma de inventario es otra cosa: un proceso que empieza, dura un rato, se puede pausar,
se revisa y recién después toca el stock. Forzarla por la pantalla de ajustes significa
cincuenta formularios sueltos, sin forma de saber qué se contó y qué no, ni de revisar antes
de aplicar.

**Persona:**

```
Nombre: Bodeguero
Rol: Bodega · cuenta caminando entre estanterías
Meta: Terminar el conteo sin perder el hilo y sin volver a empezar
Frustración: Anotar en papel y después transcribir; que lo interrumpan y no saber dónde iba
Comportamiento: Teléfono en una mano, producto en la otra. A veces con lector de código.
Frase: "¿Ya conté este pasillo?"
Comodidad técnica: Baja-media
```

**Esta es la primera pantalla del sistema que es genuinamente móvil primero.** Nadie cuenta
inventario sentado frente a un notebook.

---

## 1. Las tres decisiones que definen si sirve

Antes del flujo, tres cosas que hay que resolver o el resultado no es confiable.

### 1.1 El stock se mueve mientras cuentas

Si el local está vendiendo, lo que contaste a las 10:00 ya no es lo que el sistema dice a las
14:00. Comparar sin más produce diferencias que no existen, y el equipo concluye que "el
sistema está malo".

**Propuesta:** cada línea guarda **cuándo se contó**. Al aplicar, el ajuste no es
`contado − stockActual`, sino:

```
stock final = contado + (movimientos de ese producto desde que se contó)
```

Así una venta posterior al conteo no aparece como faltante. Es la única forma de contar con
el local abierto sin ensuciar el resultado, y el dato ya está disponible: `MovimientoInventario`
tiene `creadoEn`.

### 1.2 Conteo ciego

Si la pantalla muestra "el sistema dice 12" mientras el bodeguero cuenta, deja de contar y
empieza a **confirmar**. Es el sesgo mejor documentado de las tomas de inventario, y anula el
propósito del ejercicio.

**Propuesta:** primera pasada a ciegas — solo el producto y un campo vacío. El esperado
aparece recién en la revisión. Para el **recuento** de las diferencias sí se muestra, porque
ahí el objetivo es explicar la discrepancia, no descubrirla.

Es configurable por si el equipo lo rechaza, pero el valor por defecto debería ser ciego.

### 1.3 Quién aprueba

Un ajuste de inventario es plata: cambia la valorización y borra el rastro de lo que faltaba.
Que la misma persona cuente y aplique elimina el control.

**Propuesta:** Bodega **cuenta y cierra**; Encargado o Gerencia **revisa y aplica**. Encaja
con el sistema de perfiles que ya existe: dos secciones distintas, `inventario.toma` para
contar y `inventario.toma-aprobar` para aplicar.

Con umbral: si la diferencia total en dinero está bajo cierto monto, puede autoaplicarse.
Frenar una toma de $3.000 para que la firme el gerente es burocracia.

---

## 2. El flujo

```
[Bodega] Nueva toma
   └→ Elige alcance: todo · una categoría · una ubicación · una marca
      └→ El sistema congela el esperado y crea una línea por producto
         └→ CONTEO (móvil, ciego, pausable)
            └→ Cierra el conteo
               └→ <¿Hay diferencias?>
                  NO  → Se aplica sola, sin movimientos. Fin.
                  SÍ  → REVISIÓN
                        └→ [Bodega] Recuenta las líneas que difieren
                           └→ [Encargado] Revisa con el valor en $
                              └→ Aplica → genera los AJUSTE con trazabilidad
                              └→ o Rechaza → vuelve a conteo
```

**Estados:** `ABIERTA` → `CONTADA` → `APLICADA`, más `ANULADA` en cualquier punto.

Una toma abierta bloquea abrir otra con alcance solapado en el mismo local: dos personas
contando el mismo pasillo generan dos verdades.

---

## 3. Alcance: conteo cíclico, no inventario anual

El inventario total una vez al año paraliza el local un sábado y para cuando termina ya está
desactualizado. Con 350 SKUs y dos locales, lo que corresponde es **conteo cíclico**: contar
un pedazo cada semana y que en el año todo pase varias veces.

Alcances que propongo:

| Alcance | Cuándo | Tamaño típico |
|---|---|---|
| **Por ubicación** | Semanal, el más práctico | Un pasillo, 20–40 SKUs |
| **Por categoría** | Mensual | Pinturas, Solventes… |
| **Por marca** | Cuando llega un proveedor | Sikkens, 3M… |
| **Solo los caros** | Mensual, los de mayor valor en stock | 20–30 SKUs |
| **Total** | Cierre anual | 350 SKUs |

"Solo los caros" es el que más rinde: el 20% de los productos concentra el 80% del valor y son
los que conviene vigilar seguido.

> **Requisito:** el conteo por ubicación necesita que `StockLocal.ubicacion` esté cargada. Hoy
> el campo existe pero está vacío. Sin eso, ese alcance no sirve y el bodeguero cuenta en el
> orden alfabético del catálogo, que no es el orden en que están las cosas en la bodega.

---

## 4. Pantallas

### 4.1 Contar (móvil)

```
┌─────────────────────────────┐
│ ← Toma TI-000014      ⏸ 18/40│
│ Pasillo 2 · Fenix S. Bernardo│
├─────────────────────────────┤
│ ████████████░░░░░░░░  45%   │
├─────────────────────────────┤
│ [🔍 Escanea o busca…]       │
├─────────────────────────────┤
│                             │
│   SIKKENS                   │
│   Laca HS 1Lt Kit           │
│   SIK-LHS-1L · Pasillo 2-B  │
│                             │
│   ┌───────────────────────┐ │
│   │                       │ │
│   │         12            │ │  ← teclado numérico
│   │                       │ │
│   └───────────────────────┘ │
│                             │
│   [  −  ]        [  +  ]    │
│                             │
│   [   Guardar y siguiente  ]│  ← 56px
│   [ Saltar por ahora ]      │
│                             │
├─────────────────────────────┤
│ Contados 18 · Faltan 22     │
└─────────────────────────────┘
```

- **Un producto a la vez**, no una lista. Contando de pie con una caja en la mano, una tabla
  de 40 filas es imposible de operar sin equivocarse de renglón.
- **No se muestra el esperado.** Ver §1.2.
- **"Saltar por ahora"** existe porque el producto puede no estar donde dice. Vuelve al final
  de la cola en vez de bloquear.
- El escáner salta directo a ese producto: es lo que hace el conteo rápido de verdad.
- **Guarda cada línea al momento**, no al final. Si se corta el internet o se cierra la app,
  no se pierde el trabajo de una hora.
- Botones de 56px: se opera con una mano y a veces con guantes.

### 4.2 Revisar y aplicar (escritorio)

```
┌────────────────────────────────────────────────────────────────────────┐
│ ← Tomas    TI-000014 · Pasillo 2 · Fenix San Bernardo    [ Aplicar ]   │
│ Contada por Jorge S. · 27 jul 11:40 · 40 productos                     │
├────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                 │
│ │ CUADRARON     │ │ CON DIFERENCIA│ │ IMPACTO EN $  │                 │
│ │ 34 de 40      │ │ 6             │ │ −$182.400     │                 │
│ └───────────────┘ └───────────────┘ └───────────────┘                 │
├────────────────────────────────────────────────────────────────────────┤
│ (Con diferencia 6)(Cuadraron 34)(Sin contar 0)                         │
│ ─────────────────────────────────────────────────────────────────────  │
│ PRODUCTO           ESPERADO  CONTADO   DIF   VALOR      MOTIVO         │
│ Laca HS 1Lt            14       12      −2  −$47.000  [ Merma ▾ ]      │
│ Diluyente 5Lt           8        8+1     0        —   ← vendido 11:05  │
│ Masilla plástica       30       22      −8  −$96.000  [ Elegir ▾ ] ⚠   │
│ Primer HS 1/4           5        7      +2  +$18.400  [ Elegir ▾ ]     │
│                                                                        │
│ ⚠ Diferencias sobre 5 unidades: conviene recontar antes de aplicar     │
│                                    [ Pedir recuento ]  [ Aplicar ]     │
└────────────────────────────────────────────────────────────────────────┘
```

- **Por defecto se muestran solo las diferencias.** Las 34 que cuadraron no necesitan
  atención; están a un chip de distancia si alguien quiere verlas.
- **El valor en pesos** es lo que convierte esto en una decisión de negocio. "Faltan 8
  unidades" no dice nada; "−$96.000" sí.
- **La columna Contado muestra el ajuste por movimientos posteriores** (`8+1`, "vendido
  11:05"). Sin esa explicación, el encargado ve un número que no cuadra con lo que reportó
  el bodeguero y desconfía de los dos.
- **Motivo por línea**, obligatorio sobre cierto monto: merma, robo, error de recepción, error
  de conteo, producto vencido. Sin motivo, el ajuste es un número sin historia y el mes
  siguiente nadie sabe qué pasó.
- **Aviso de recuento** en diferencias grandes, pero sin bloquear: el encargado puede decidir.

### 4.3 Listado de tomas

Tabla estándar del sistema con chips por estado (Abiertas · Contadas · Aplicadas), buscador y
paginación. La fila muestra folio, alcance, quién contó, diferencias y el impacto en $.

---

## 5. Modelo de datos

```prisma
enum EstadoToma { ABIERTA, CONTADA, APLICADA, ANULADA }
enum AlcanceToma { TOTAL, CATEGORIA, UBICACION, MARCA, ALTO_VALOR }
enum MotivoAjuste { MERMA, ROBO, ERROR_RECEPCION, ERROR_CONTEO, VENCIDO, OTRO }

model TomaInventario {
  id           String       @id @default(cuid())
  correlativo  Int          @unique
  localId      String
  local        Local        @relation(...)
  estado       EstadoToma   @default(ABIERTA)
  alcance      AlcanceToma
  /// Valor del alcance: id de categoría, texto de ubicación, marca…
  filtro       String?
  /// El conteo no muestra el esperado. Ver §1.2
  ciego        Boolean      @default(true)
  nota         String?
  creadoPorId  String
  creadoEn     DateTime     @default(now())
  cerradaEn    DateTime?
  aplicadaPorId String?
  aplicadaEn   DateTime?
  lineas       TomaLinea[]

  @@index([localId, estado])
}

model TomaLinea {
  id         String        @id @default(cuid())
  tomaId     String
  toma       TomaInventario @relation(..., onDelete: Cascade)
  productoId String
  producto   Producto      @relation(...)
  /// Congelado al abrir la toma
  esperado   Int
  contado    Int?
  /// Para descontar los movimientos posteriores al conteo. Ver §1.1
  contadoEn  DateTime?
  contadoPorId String?
  motivo     MotivoAjuste?
  /// El ajuste que se generó al aplicar, para poder auditar hacia atrás
  movimientoId String?

  @@unique([tomaId, productoId])
  @@index([tomaId])
}
```

`MovimientoInventario` gana un `tomaLineaId?` opcional, para que desde el historial de
movimientos se pueda llegar a la toma que lo originó.

---

## 6. Permisos

Dos secciones nuevas en el catálogo, coherentes con lo que ya existe:

| Sección | Qué permite | Admin | Gerente | Encargado | Vendedor | Bodega |
|---|---|:--:|:--:|:--:|:--:|:--:|
| `inventario.toma` | Abrir, contar y cerrar | T | T | T | — | **T** |
| `inventario.toma-aprobar` | Aplicar el ajuste al stock | T | T | T | — | **—** |

Bodega cuenta pero no aplica. Es la separación que hace que el control exista.

---

## 7. Riesgos y cosas que resolver

**🔴 Las ubicaciones están vacías.** `StockLocal.ubicacion` existe pero nadie la ha cargado.
El alcance por ubicación —el más útil para conteo cíclico— no funciona hasta que se llene.
Se puede cargar durante la primera toma total, que es cuando alguien recorre todo igual.

**🟠 Una toma total con el local abierto.** 350 SKUs son varias horas; con ventas de por medio
la corrección por movimientos posteriores funciona, pero cuanto más larga la toma, más ruido.
Para la total conviene local cerrado; para las cíclicas de un pasillo, da lo mismo.

**🟠 Productos sin fila de stock.** Si un producto nunca tuvo movimiento en el local, no tiene
`StockLocal` y quedaría fuera de la toma — justo el caso donde puede haber mercadería no
registrada. La toma debería incluir todo el catálogo activo del alcance, con esperado 0.

**🟡 El costo del ajuste.** Aplicar la toma cambia el valor del inventario. Con `precioCosto`
como CPP, un faltante de 8 unidades son $96.000 que desaparecen de la valorización sin pasar
por ningún estado de resultados. Vale la pena que el reporte de inventario muestre "ajustes
del mes" como línea aparte.

---

## 8. Checklist

- [x] Móvil primero para contar, escritorio para revisar
- [x] Conteo ciego por defecto, con recuento informado
- [x] Corrección por movimientos posteriores al conteo
- [x] Separación entre quien cuenta y quien aplica
- [x] Guardado por línea: una interrupción no borra el trabajo
- [x] Accesibilidad: botones de 56px, teclado numérico, un producto a la vez
- [ ] Estados: toma vacía, producto sin encontrar, conflicto de dos tomas
- [ ] **Abierto:** ¿la primera toma es total para cargar las ubicaciones?
- [ ] **Abierto:** ¿umbral en $ bajo el cual bodega aplica sin aprobación?

---
---

# v2 — Planificación, planilla y lista flexible

> Propuesta para validar. Extiende el diseño de arriba, no lo reemplaza.
> Lo de §1 (corrección por movimientos posteriores, conteo ciego, separación de roles)
> sigue siendo la base y v2 depende de que se respete.

## 9. El hallazgo que ordena todo lo demás

Contar en planilla y programar la toma **no son dos pedidos separados**: el segundo es
requisito del primero.

El cálculo de §1.1 es `stock final = contado + movimientos desde contadoEn`. Hoy `contadoEn`
se graba con `new Date()` en el momento de digitar, lo que es correcto cuando se cuenta en el
móvil: se cuenta y se graba en el mismo segundo.

Con planilla eso se rompe. El bodeguero cuenta el lunes en papel y alguien digita el
miércoles. Si al importar se graba `contadoEn = miércoles`, las ventas del lunes al miércoles
**no se suman de vuelta**, y aparecen como faltantes que nadie causó:

```
Lunes 09:00   se cuenta a mano             → 12 unidades
Lunes 15:00   se venden 3                  → stock sistema: 9
Miércoles     se importa la planilla

contadoEn = miércoles →  objetivo 12, stock 9  → ajuste +3   ✗ inventa mercadería
contadoEn = lunes     →  objetivo 12 + (−3) = 9, stock 9 → sin ajuste   ✓
```

**Por lo tanto la fecha del conteo es un dato funcional, no un campo informativo.** La
importación tiene que usar la fecha declarada del conteo como `contadoEn`, nunca la del
upload. Esto es lo que hace que las dos features funcionen juntas en vez de pelearse.

Corolario: la planilla lleva una celda **Fecha del conteo** que el bodeguero completa, y la
pantalla de importación la muestra para confirmar antes de aplicar.

---

## 10. Estados: entra PROGRAMADA

```
[Encargado] Programa la toma          PROGRAMADA   ← no congela stock
   └→ cura la lista de productos       (editable)
      └→ [Bodega] Iniciar conteo       ABIERTA     ← acá se congela el esperado
         └→ cuenta: móvil o planilla
            └→ Cierra el conteo        CONTADA     → avisa al encargado
               └→ [Encargado] revisa   APLICADA
```

`ANULADA` sigue disponible desde PROGRAMADA, ABIERTA y CONTADA.

**Por qué PROGRAMADA no congela el stock.** Si se programa el lunes una toma para el viernes
y se congelara el esperado al programar, ese número llega con cuatro días de ventas encima.
El esperado se saca **al iniciar el conteo**, no al planificar.

**Las líneas sí se materializan al programar.** Es lo que permite curar la lista con calma
antes de que el bodeguero salga a contar. Separamos dos cosas que hoy están pegadas:

| | Cuándo se define | Editable |
|---|---|---|
| **Qué productos** se cuentan | al programar | sí, hasta que se cierra el conteo |
| **Qué esperaba el sistema** (`esperado`) | al iniciar el conteo | no |

**Quién hace qué.** Programar y curar la lista: `inventario.toma-aprobar` (encargado o
administrador). Iniciar conteo, contar y cerrar: `inventario.toma` (bodega). Es la separación
que ya existe en el catálogo de secciones — no hay permisos nuevos.

> Nota: no se agenda con cron. El día programado aparece el botón "Iniciar conteo"; si se
> inicia antes o después, se registra igual y la lista muestra el desvío. Un cron en Vercel
> para abrir tomas solo agrega una pieza que puede fallar de noche.

---

## 11. Pantalla nueva: lista de productos de la toma

Es la que falta hoy. Escritorio, para el encargado, en estados PROGRAMADA y ABIERTA.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Tomas de inventario                                                        │
│ TI-000014  (Programada)         Fenix Buin · Pasillo 2 · 12 sep             │
│ Programada por Nelson · 2 ago                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│ [ ⬇ Descargar planilla ]  [ ⬆ Importar conteo ]      [ Iniciar conteo ]      │
├──────────────────────────────────────────────────────────────────────────────┤
│ Agregar artículo   [🔍 Buscar por código o descripción…            ▾]        │
├──────────────────────────────────────────────────────────────────────────────┤
│ Nro  CÓDIGO      DESCRIPCIÓN            UBICACIÓN    ORIGEN        CONTADO  🗑│
│  1   SIK-LHS-1L  Laca HS 1Lt Kit        Pasillo 2-B  alcance          —    🗑│
│  2   3M-255-P80  Lija 255P grano 80     Pasillo 2-A  alcance          —    🗑│
│  3   FEN-DIL-5L  Diluyente 5Lt          Pasillo 2-C  agregada         —    🗑│
│ ...                                                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ 16 productos · 3 agregados a mano · 0 contados                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Decisiones:**

- **El buscador de artículos es el mismo `BuscadorArticulo` de `EditorLineas`**, el que ya usan
  Orden de Compra y el documento de movimiento. Misma interacción para "elegir un producto"
  en todo el sistema: buscar por SKU, código de barra, nombre o marca.
- **No se muestra la columna `esperado`.** Ni acá. La lista de curación la ve el encargado,
  pero la misma pantalla la puede tener abierta el bodeguero, y §1.2 aplica igual.
- **`ORIGEN` distingue lo que trajo el alcance de lo que alguien agregó.** Al revisar, seis
  faltantes en productos que el alcance no incluía significa algo distinto que seis faltantes
  en el pasillo que se pidió contar.
- **Quitar una línea solo se permite si no tiene conteo.** Si ya la contaron, primero hay que
  borrar el conteo — con confirmación explícita. Así no se destruye trabajo con un clic
  distraído, y no necesitamos un campo `excluida` en el modelo.
  *Alternativa si quieren quitar líneas ya contadas: `excluidaPorId`/`excluidaEn` en
  `TomaLinea`, conservando el conteo como registro. Más fiel para auditoría, un campo más.*
- **En ABIERTA se puede seguir agregando**, no solo en PROGRAMADA. Aparecer mercadería que
  nadie esperaba es el hallazgo más valioso de una toma; obligar a cerrarla y abrir otra
  garantiza que el bodeguero no lo reporte.

---

## 12. La planilla .xlsx

### 12.1 Descarga — `GET /dashboard/inventario/tomas/[id]/planilla`

Mismo patrón que `/dashboard/inventario/plantilla` (ExcelJS, `Content-Disposition`).

**Hoja "Conteo":**

| Nro | SKU | Código de barra | Descripción | Marca | Ubicación | **Cantidad contada** | Observación |
|--:|---|---|---|---|---|---|---|
| 1 | SIK-LHS-1L | 78091… | Laca HS 1Lt Kit | Sikkens | Pasillo 2-B | | |

- **Sin columna de esperado.** Es la decisión de §1.2 llevada al papel. Una planilla con el
  esperado al lado se completa copiando la columna, y la toma deja de medir.
- Cabecera congelada, hoja protegida salvo las columnas **Cantidad contada** y **Observación**:
  el SKU es la llave de la importación y si se edita, la fila no matchea.
- Celdas de cabecera con **folio, local, alcance y `Fecha del conteo`** (esta última la
  completa el bodeguero — ver §9).
- Una hoja **"Instrucciones"** breve, como la plantilla de productos.
- Una celda con el **id de la toma** para validar al importar que el archivo corresponde a
  esta toma y no a otra. Sin eso, subir la planilla de TI-000012 a TI-000014 escribe conteos
  cruzados sin que nadie lo note.
- Orden de las filas: **por ubicación**, no alfabético. Se cuenta caminando, y el orden del
  papel debería ser el orden del pasillo.

### 12.2 Importación — vista previa antes de escribir

Copia el patrón que ya funciona en productos (`previsualizarImportacionProductos` →
`aplicarImportacionProductos`): nada se guarda hasta que el usuario confirma.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Importar conteo · TI-000014                                                  │
│ Archivo: conteo-TI-000014.xlsx      Fecha del conteo: [ 10-09-2026 ]  ⓘ      │
├──────────────────────────────────────────────────────────────────────────────┤
│  14 conteos a cargar     2 SKU nuevos      1 sin contar      1 con error     │
├──────────────────────────────────────────────────────────────────────────────┤
│ FILA  SKU          DESCRIPCIÓN          CONTADO   ESTADO                     │
│   2   SIK-LHS-1L   Laca HS 1Lt Kit          12    Se carga                   │
│   3   3M-255-P80   Lija 255P grano 80        —    Sin contar (queda pendiente)│
│   4   FEN-MAS-1K   Masilla plástica          22    Se agrega como línea nueva │
│   9   XXX-999      —                          5    Error: el SKU no existe    │
├──────────────────────────────────────────────────────────────────────────────┤
│                        [ Cancelar ]   [ Cargar 14 conteos y 2 líneas nuevas ]│
└──────────────────────────────────────────────────────────────────────────────┘
```

- **La fecha del conteo es editable y visible acá**, con el ⓘ explicando que de ella depende
  el cálculo de diferencias. Sale de la celda de la planilla; si viene vacía, se pide.
- **SKU que no está en la toma → se agrega como línea nueva** con `esperado = stock actual` y
  `origen = AGREGADA_IMPORT`, destacada en la vista previa.
- **Celda vacía ≠ cero.** Vacío es "no lo conté" y la línea queda pendiente; `0` es "conté y
  no hay ninguno", que es un faltante total y un dato valioso. Confundirlos convertiría cada
  producto no contado en una merma del 100%.
- Errores por fila con el número de fila, para poder corregir el archivo y reintentar.
- Reimportar sobreescribe los conteos de las líneas que vengan con dato, y avisa cuántas
  ya tenían uno.

---

## 13. Revisión: qué ya existe y qué falta

Lo que pediste —ver stock, contado y diferencia para ajustar— **ya está implementado** en
`RevisionToma`: muestra esperado, contado, stock actual, objetivo, diferencia en unidades y
en pesos, motivo por línea, y los chips *Con diferencia / Cuadraron / Sin contar*. Está en
`/dashboard/inventario/tomas/[id]`, visible cuando la toma está `CONTADA` y quien mira tiene
`inventario.toma-aprobar`.

Lo que le falta para cerrar este flujo:

1. **Badge de origen por línea** — contada en móvil · importada de planilla · agregada en el
   conteo. El encargado necesita saber si un faltante viene de un conteo digitado a mano.
2. **`contadoPorId` en `TomaLinea`** — el doc de v1 lo especificaba (§5) pero no llegó al
   schema. Con dos personas contando pasillos distintos, "quién contó esta línea" es lo
   primero que se pregunta ante una diferencia grande.
3. **Aviso de conteo antiguo** — si la fecha del conteo tiene más de N días, mostrarlo: la
   corrección por movimientos posteriores funciona, pero con más ruido cuanto más viejo.

---

## 14. Aviso al encargado

Sin tablas nuevas ni servicios externos.

- `tomasPorRevisar(localId)` cuenta las tomas en estado `CONTADA`. El dato ya se calcula
  dentro de `listaTomas`; solo hay que exponerlo aparte.
- **Badge numérico** en la sección Inventario del menú lateral.
- **Tarjeta en el dashboard** del encargado y de gerencia (`DashJefeLocal`, `DashGerencia`):
  «2 tomas esperando revisión · −$182.400 en diferencias», con enlace directo.
- Cuando el bodeguero cierra el conteo, la confirmación le dice a quién le llegó: «Conteo
  cerrado. El encargado de Fenix Buin ya lo tiene para revisar.» Cerrar sin saber si alguien
  se enteró es la razón por la que la gente manda un WhatsApp además.

*Email queda como extensión: la infraestructura existe (`EmailBoleta` en el POS), pero
requiere definir el destinatario por local, que hoy no está modelado.*

---

## 15. Modelo de datos — cambios

```prisma
enum EstadoToma { PROGRAMADA, ABIERTA, CONTADA, APLICADA, ANULADA }

/// De dónde salió la línea: el alcance o alguien que la agregó
enum OrigenLinea { ALCANCE, AGREGADA_MANUAL, AGREGADA_IMPORT }

/// Cómo se digitó el conteo, para saber cuánto confiar en él
enum OrigenConteo { MOVIL, PLANILLA }

model TomaInventario {
  // …lo que ya existe
  fechaProgramada DateTime?   // día planificado; null en tomas abiertas directo
  fechaConteo     DateTime?   // día real del conteo — de acá sale contadoEn (§9)
  abiertaEn       DateTime?
  abiertaPorId    String?
  abiertaPor      Usuario?    @relation("TomasAbiertas", …)
}

model TomaLinea {
  // …lo que ya existe
  origen        OrigenLinea   @default(ALCANCE)
  origenConteo  OrigenConteo?
  contadoPorId  String?       // faltaba desde v1
  contadoPor    Usuario?      @relation("LineasContadas", …)
}
```

`esperado` deja de escribirse al crear la toma y se escribe al pasar a `ABIERTA`. Para las
tomas que hoy están en ABIERTA no cambia nada: la migración las deja como están.

---

## 16. Orden de implementación

Por dependencia, no por tamaño:

| Fase | Qué | Estado | Por qué en este orden |
|---|---|---|---|
| **1** | `fechaConteo` + `contadoPorId` + origen | **implementada** | Sin la fecha, la planilla produce ajustes falsos (§9). Es el cimiento. |
| **2** | Descarga de planilla | **implementada** | Entrega valor sola: se puede contar en papel aunque la importación no exista todavía. |
| **3** | Importación con vista previa | **implementada** | Cierra el ciclo del papel. |
| **4** | Lista editable de líneas | pendiente | Independiente de la planilla; mejora también el flujo móvil. |
| **5** | `PROGRAMADA` + planificación | pendiente | El estado nuevo toca el flujo completo: conviene con lo demás estable. |
| **6** | Aviso in-app | pendiente | Barato y aislado; se puede adelantar si molesta la falta de visibilidad. |

Las fases 1–3 se entregaron juntas. Migración: `20260802200000_conteo_por_planilla`.

> **Hallazgo durante la implementación.** `lib/fechas.ts` existe porque Vercel corre en UTC,
> y las dos primeras versiones de este código lo ignoraban: la hora declarada del conteo se
> construía con `new Date(y, m, d, h)` —hora del servidor—, así que un conteo a las 09:00
> quedaba grabado a las 05:00 de Chile y la ventana de movimientos posteriores arrancaba
> cuatro horas antes de lo declarado. Toda fecha de este flujo pasa ahora por
> `instanteSantiago` / `partesSantiago` / `diasEntre`.

---

## 17. Riesgos de v2

**🔴 La planilla se puede editar.** Excel protegido no es seguridad: quien quiera, desprotege
la hoja y cambia un SKU. Mitigación real: validar en la importación que el SKU exista y
pertenezca al catálogo, y registrar `origenConteo = PLANILLA` para que el encargado sepa que
esa línea pasó por un archivo que estuvo fuera del sistema.

**🟠 Dos fuentes de conteo para la misma línea.** Alguien cuenta en el móvil y además la
planilla trae un número para ese producto. La importación debe avisar cuántas líneas ya
tenían conteo antes de sobreescribir, y dejar cancelar.

**🟠 Conteo viejo con local abierto.** Cuanto más tiempo pasa entre `fechaConteo` y la
importación, más movimientos hay que sumar de vuelta y más chances de que uno de ellos esté
mal registrado. Vale un aviso sobre cierta cantidad de días.

**🟡 `PROGRAMADA` y el bloqueo de tomas.** Hoy una toma `ABIERTA` bloquea abrir otra en el
local. Hay que decidir si varias `PROGRAMADA` pueden coexistir — creo que sí, es justo el
plan mensual de conteos cíclicos —, y que el bloqueo siga aplicando solo a `ABIERTA`.

---

## 18. Checklist v2

- [x] La fecha del conteo manda sobre la fecha de digitación (§9)
- [x] La planilla no revela el esperado
- [x] Vista previa antes de escribir conteos
- [x] Vacío ≠ cero en la planilla
- [x] Validación de que el archivo corresponde a la toma
- [x] Quitar líneas no destruye conteos en silencio
- [x] Un solo patrón para elegir artículo en todo el sistema
- [ ] **Abierto:** ¿cuántos días de antigüedad de conteo disparan el aviso?
- [ ] **Abierto:** ¿la planilla se ordena por ubicación aunque el alcance no sea por pasillo?
- [ ] **Abierto:** ¿varias tomas PROGRAMADA a la vez en el mismo local?
