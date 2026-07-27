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
