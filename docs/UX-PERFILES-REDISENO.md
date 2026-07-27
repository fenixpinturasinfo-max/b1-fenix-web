# Perfiles · Alternativas de rediseño

> **Alternativa B implementada** (julio 2026), junto con todas las mejoras transversales de §2.
> A y C quedan documentadas por si el uso real las pide más adelante.
>
> Dónde vive: `features/perfiles/components/{EditorPermisos,VistaPreviaMenu,nivelUi}.tsx` ·
> `lib/auth/secciones.ts` (`agruparMenu`, `resumenPerfil`) ·
> `app/dashboard/configuracion/perfiles/*`.

---

## 0. Punto de partida

**Persona:** el administrador. No es desarrollador, entra pocas veces al año —normalmente
cuando llega alguien nuevo o cuando algo quedó visible y no debía. Su miedo es dejar a alguien
sin poder trabajar el lunes a las 9.

**Su pregunta real no es "¿qué nivel tiene la sección Facturas?"**, es una de estas tres:

1. *"¿Qué va a ver esta persona cuando entre?"*
2. *"¿Por qué Pedro ve algo que Camila no?"*
3. *"Entró alguien nuevo a bodega, ¿le dejo lo mismo que al otro bodeguero?"*

La pantalla de hoy responde bien a una cuarta pregunta —*"¿qué nivel tiene cada sección?"*—
que es la del sistema, no la del usuario. Ese es el desajuste de fondo.

---

## 1. Evaluación heurística de la pantalla actual

| Heurística | Estado | Hallazgo |
|---|---|---|
| 8 · Estética y diseño minimalista | ❌ | 20 filas idénticas con 3 botones cada una: 60 objetivos de clic sin jerarquía. ~1.300 px de scroll. |
| 6 · Reconocer antes que recordar | ❌ | Comparar dos perfiles obliga a abrir uno, memorizar y abrir el otro. No hay vista comparativa. |
| 2 · Correspondencia con el mundo real | ⚠️ | "Nivel de acceso a la sección Boletas" es lenguaje de sistema. El admin piensa en "puede vender", "puede recibir mercadería". |
| 1 · Visibilidad del estado | ⚠️ | "9 de 20 secciones" no transmite la forma del perfil. Dos perfiles muy distintos pueden dar el mismo número. |
| 7 · Flexibilidad y eficiencia | ⚠️ | No hay copiar desde otro perfil, ni plantillas, ni buscador. La tarea más común —"déjalo como el otro bodeguero"— se hace a mano, clic por clic. |
| 4 · Consistencia | ⚠️ | Total se pinta en azul eléctrico, que en el resto del sistema es "seleccionado", no "concedido". El verde lima ya significa "activo/ok" en badges de stock y caja. |
| 5 · Prevención de errores | ✅ | Guardado explícito, diff antes de confirmar, protecciones de autobloqueo. Esto quedó bien. |
| 3 · Control y libertad | ✅ | Descartar disponible, nada se aplica sin confirmar. |

**Carga cognitiva:** el problema no es que haya 20 decisiones, es que las 20 se ven igual de
importantes. En la práctica el 80 % de un perfil no se toca nunca y solo 3 o 4 filas importan.

---

## 2. Mejoras transversales

Estas aplican a cualquiera de las tres alternativas y son las de mejor relación
esfuerzo/beneficio. Las recomiendo aunque no cambies el layout.

### 2.1 Resumen en lenguaje natural

Generado desde la matriz, en el listado y arriba del editor:

> **Vendedor** — Puede vender en caja y tomar pedidos. Consulta la lista de partidas.
> No ve inventario, compras ni reportes.

Responde la pregunta 1 sin leer una sola fila. Se arma con una plantilla por módulo
(`ventas` con POS en Total → "puede vender en caja").

### 2.2 Huella visual del perfil

Una barra de 20 segmentos coloreados por nivel, en la fila de cada perfil:

```
Gerente      ████████████████░░░░   17 secciones
Encargado    ███░██░███░░░░░░░░░░   9 · 1 solo lectura
Vendedor     ░░░░░░░░░░░███▓░░░░░   4
```

Dos perfiles con el mismo conteo se distinguen de un vistazo. Cuesta ~20 líneas de código y
es lo que más cambia la percepción de "esto se ve ordenado".

### 2.3 Color semántico

Hoy Total = azul eléctrico (que en el sistema significa "seleccionado"). Propuesta, usando
tokens que ya existen:

```
Total        lime-400/20 + texto #4d7c0f     ✓ concedido
Solo lectura #f59e0b/20 + texto #b45309      ◐ parcial
Sin acceso   slate-200 + texto slate-500     — cerrado
```

Con ícono además del color: ✓ / ◐ / —. El nivel nunca depende solo del tono.

### 2.4 Copiar desde otro perfil

Un selector en el editor: *"Partir desde: [Bodega ▾]"* que precarga la matriz de ese perfil
como cambios sin guardar. Resuelve la pregunta 3 en dos clics en vez de veinte.

### 2.5 Densidad y orientación

- Filas de 44 px en vez de 64 (20 filas pasan de ~1.300 px a ~900).
- Encabezado de módulo **sticky** al hacer scroll, con su contador: `Compras 2/6`.
- Buscador que filtra secciones por nombre. Hoy con 20 es opcional; con 40 es obligatorio.

---

## 3. Alternativa A · Matriz comparativa

Una sola pantalla: filas = secciones, columnas = perfiles. Se edita en la celda.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Perfiles                                    [🔍 Buscar sección]  [Guardar] │
│ Qué ve y qué puede hacer cada tipo de cuenta                               │
├────────────────────────────────────────────────────────────────────────────┤
│                          ADMIN   GERENTE  ENCARGADO  VENDEDOR   BODEGA     │
│                            🔒       1         2          2         2  ← usuarios
│ ─────────────────────────────────────────────────────────────────────────  │
│ ▼ INVENTARIO              5/5      5/5       2/5        0/5       3/5      │
│    Productos               ✓        ✓         ◐          —         ✓       │
│    Registrar documento     ✓        ✓         ✓          —         ✓       │
│    Movimientos             ✓        ✓         ✓          —         ✓       │
│    Precios de venta        ✓        ✓         —          —         —       │
│    Precios de compra       ✓        ✓         —          —         —       │
│ ▼ COMPRAS                 6/6      6/6       2/6        0/6       4/6      │
│    Solicitudes             ✓        ✓         ✓          —         ✓       │
│    Orden de compra         ✓        ✓         —          —         ◐       │
│    Entrada mercadería      ✓        ✓         ✓          —         ✓       │
│    ...                                                                      │
│ ▶ VENTAS                  4/4      4/4       4/4        4/4       0/4      │
│ ▶ CONFIGURACIÓN           3/3      0/3       0/3        0/3       0/3      │
└────────────────────────────────────────────────────────────────────────────┘
```

**Interacción:** clic en la celda rota Total → Lectura → Sin acceso. Clic en el encabezado de
módulo colapsa. Clic en el contador de un módulo lo aplica completo a esa columna.

**Racional:** es la vista que el admin dibujaría en un papel. La comparación —pregunta 2— sale
gratis: se ve al instante que Encargado tiene Compras casi cerrado y Bodega no.

**Contras honestos:** la columna Administrador es decorativa (siempre ✓) y ocupa espacio.
En móvil no cabe: habría que caer a la vista por perfil. Y el guardado abarca varios perfiles
a la vez, lo que hace el diff de confirmación más largo y más fácil de aprobar sin leer.

**Cuándo elegirla:** si el uso real es auditar y ajustar de a poco, más que configurar un
perfil completo de una vez.

---

## 4. Alternativa B · Editor con vista previa del menú

Se mantiene un perfil por pantalla, pero al lado se muestra **lo que esa persona verá**.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Perfiles    Encargado de Local          2 usuarios · Camila R., Pedro S.   │
│               Partir desde: [ Bodega ▾ ]                    [🔍 Buscar]      │
├───────────────────────────────────────────────┬──────────────────────────────┤
│ INVENTARIO                        2/5  [⋯]    │  ASÍ VERÁ EL MENÚ            │
│  ✓ ◐ —   Productos                            │  ┌────────────────────────┐  │
│          Stock, mínimos y ubicaciones         │  │ 🏠 Dashboard           │  │
│  ✓   —   Registrar documento                  │  │ 📦 Inventario          │  │
│          Entradas, mermas, ajustes            │  │    Productos      👁    │  │
│  ✓ ◐ —   Movimientos                          │  │    Registrar doc.      │  │
│  ✓ ◐ —   Precios de venta                     │  │    Movimientos         │  │
│  ✓ ◐ —   Precios de compra                    │  │ 🛒 Compras             │  │
│                                               │  │    Solicitudes         │  │
│ COMPRAS                           2/6  [⋯]    │  │    Entrada mercadería  │  │
│  ✓ ◐ —   Solicitudes                          │  │ 🧾 Ventas              │  │
│  ✓ ◐ —   Orden de compra                      │  │    Pedidos             │  │
│  ✓ ◐ —   Entrada mercadería                   │  │    POS                 │  │
│  ...                                          │  │    Boletas             │  │
│                                               │  │ 📊 Reportes            │  │
│                                               │  └────────────────────────┘  │
│                                               │  👁 = solo lectura           │
├───────────────────────────────────────────────┴──────────────────────────────┤
│ 3 cambios sin guardar                       [ Descartar ]  [ Guardar ]       │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Interacción:** el menú de la derecha se actualiza en vivo con cada clic. Los ítems en solo
lectura llevan un 👁. Es sticky mientras se hace scroll por la izquierda.

**Racional:** convierte una lista abstracta de permisos en el artefacto concreto que el admin
está tratando de controlar. Responde la pregunta 1 —*"¿qué va a ver?"*— sin que tenga que
imaginárselo. También enseña la regla del sistema sin explicarla: cuando cierra las 6 secciones
de Compras, el grupo entero desaparece del preview.

**Contras honestos:** necesita ancho; bajo `lg` el preview pasa a un botón "Ver menú" que abre
un panel. Y sigue sin resolver la comparación entre perfiles.

**Cuándo elegirla:** si lo que más cuesta hoy es entender el efecto de lo que se está marcando.

---

## 5. Alternativa C · Plantillas y excepciones

Cambia el modelo mental: en vez de configurar 20 filas, se elige un punto de partida y solo
se tocan las diferencias.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Perfiles      Encargado de Local              2 usuarios               │
├──────────────────────────────────────────────────────────────────────────┤
│ ¿Qué hace esta persona?                                                  │
│                                                                          │
│  ( ) Atiende público          Vende en caja, toma pedidos                │
│  ( ) Maneja bodega            Stock, recepciones y reposición            │
│  (•) Dirige un local          Bodega + caja + reportes de su sucursal    │
│  ( ) Dirige la cadena         Todo salvo configuración del sistema       │
│  ( ) Personalizado                                                       │
│                                                                          │
│  Con esta plantilla accede a 11 secciones.                               │
├──────────────────────────────────────────────────────────────────────────┤
│ Ajustes sobre la plantilla                                    2 cambios  │
│                                                                          │
│  − Orden de compra          quitado          [ Restaurar ]               │
│  ◐ Productos                a solo lectura   [ Restaurar ]               │
│                                                                          │
│  [ + Agregar una excepción ]                                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                    [ Descartar ]  [ Guardar cambios ]    │
└──────────────────────────────────────────────────────────────────────────┘
```

**Interacción:** "Agregar una excepción" abre un buscador de secciones; al elegir una, se
agrega a la lista con su nivel. Lo que coincide con la plantilla no se muestra: solo se ve lo
que se apartó.

**Racional:** divulgación progresiva llevada al extremo. Para alguien que entra tres veces al
año, elegir entre cuatro descripciones en castellano es incomparablemente más fácil que
resolver 20 controles. Y deja documentada la *intención* —"esto es un encargado con dos
excepciones"— en vez de una lista plana de 20 estados.

**Contras honestos:** las plantillas son código, así que agregar una nueva requiere
despliegue. Si un perfil acumula 8 excepciones, la abstracción estorba más de lo que ayuda
(mitigable: sobre 6 excepciones, ofrecer "convertir a personalizado"). Y no sirve para
auditar: no hay forma de ver el estado completo sin abrir la vista detallada.

**Cuándo elegirla:** si el uso real es configurar de cero cuando entra alguien, más que
ajustar finamente lo existente.

---

## 6. Comparación

| | A · Matriz | B · Vista previa | C · Plantillas |
|---|:--:|:--:|:--:|
| *"¿Qué verá esta persona?"* | ⚠️ | ✅ | ⚠️ |
| *"¿Por qué Pedro ve más que Camila?"* | ✅ | ❌ | ⚠️ |
| *"Déjalo como el otro bodeguero"* | ✅ | ⚠️ con §2.4 | ✅ |
| Facilidad para quien entra 3 veces al año | ⚠️ | ✅ | ✅ |
| Auditar todo el sistema de una | ✅ | ❌ | ❌ |
| Funciona en móvil | ❌ | ⚠️ | ✅ |
| Esfuerzo de construcción | Medio | Medio | Alto |
| Riesgo de aprobar cambios sin leer | Alto | Bajo | Bajo |

**Mi recomendación: B + las mejoras transversales de §2, y la matriz de A como vista de solo
lectura** en el listado de perfiles.

El razonamiento: B ataca el problema más caro —no entender el efecto de lo que se marca— y
mantiene el guardado por perfil, que es más seguro. A como vista de lectura da la comparación
sin el riesgo de editar cinco perfiles en una pantalla. Y C, aunque es la más amable, apuesta
a que las plantillas envejezcan bien; con cinco perfiles fijos que ya *son* las plantillas,
agrega una capa de indirección que todavía no se gana su lugar.

---

## 7. Checklist

- [x] Objetivo del usuario servido: las tres preguntas reales están mapeadas a alternativas
- [x] Responsive: B cae a panel bajo `lg`; A cae a la vista por perfil; C funciona en móvil
- [x] Accesibilidad: ícono + texto además de color; celdas de 44 px; `role="radiogroup"` por fila
- [x] Estados: perfil sin usuarios, sección sin nivel de lectura, perfil propio bloqueado
- [x] Copy: resumen en lenguaje natural en vez de conteos
- [x] Elegida e implementada la B, con las mejoras transversales de §2
