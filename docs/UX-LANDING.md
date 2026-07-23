# UX — Landing Page Pinturas Fenix

Referencia visual: liqui-moly.cl (tienda oficial de marca, e-commerce limpio).
Diferencia clave: Fenix es multimarca y multilocal (San Bernardo + Buin), y el checkout v1 es **carro → pedido por WhatsApp / retiro en tienda** (sin pasarela de pago).

---

## 1. Usuarios y objetivos

| Persona | Perfil | Objetivo | Frustración actual |
|---|---|---|---|
| **El Maestro** | Pintor de taller, 30-55, compra semanal, sabe exactamente qué necesita (SKU/marca) | Cotizar y reservar rápido, retirar sin esperar | Llamar/escribir por IG y esperar respuesta para saber stock y precio |
| **El Detailer** | Aficionado detailing, 20-35, compra por marca (Menzerna, 3M) | Comparar productos y precios, comprar online | No hay catálogo con precios visible |
| **El Ocasional** | Dueño de auto con rayón, poca expertise | Saber qué comprar, pedir asesoría | No sabe qué producto sirve; necesita guía |

Job-to-be-done principal: **"Ver precio y stock, armar mi pedido y retirarlo en mi local más cercano sin fricción."**

## 2. Arquitectura de información

```
/                      Landing (hero, categorías, destacados, marcas, asesoría, locales)
/catalogo              Catálogo completo con filtros (fase 2)
/catalogo/[categoria]  Listado por categoría (fase 2)
/producto/[slug]       Ficha de producto (fase 2)
/locales               Detalle sucursales (v1: sección #locales en landing)
Carro                  Drawer lateral global (no es página)
```

Navegación principal: Categorías (mega-dropdown fase 2) · Ofertas · Marcas · Locales · Contacto · [🛒 Carro].

## 3. Wireframe landing (desktop)

```
┌──────────────────────────────────────────────────────────────┐
│ TOPBAR: 🚚 Retiro en tienda San Bernardo y Buin · WhatsApp   │
├──────────────────────────────────────────────────────────────┤
│ HEADER: [Logo FENIX] | Categorías Ofertas Marcas Locales | 🛒│
├──────────────────────────────────────────────────────────────┤
│ HERO (navy oscuro, gradiente fénix rojo/naranja)             │
│  H1: "Especialistas en pintura automotriz"                   │
│  Sub: pinturas, insumos y accesorios · marcas líderes        │
│  [Ver catálogo]  [Pedir asesoría →WhatsApp]                  │
│  Visual: producto/latas + destello fénix                     │
├──────────────────────────────────────────────────────────────┤
│ TRUST STRIP: +9 marcas líderes | 2 locales | Asesoría experta│
├──────────────────────────────────────────────────────────────┤
│ CATEGORÍAS (grid 6): Pinturas y Lacas · Primers · Pulido y   │
│ Detailing · Lijas y Abrasivos · Accesorios · Kits            │
├──────────────────────────────────────────────────────────────┤
│ OFERTAS / DESTACADOS: carrusel/grid de cards                 │
│  [img | marca | nombre | $precio CLP | + Agregar]            │
├──────────────────────────────────────────────────────────────┤
│ MARCAS: logos Sikkens·Sherwin-Williams·3M·Norton·Menzerna…   │
├──────────────────────────────────────────────────────────────┤
│ ASESORÍA (equivalente al "buscador de lubricantes" de LM):   │
│  "¿No sabes qué producto necesitas?" → CTA WhatsApp          │
├──────────────────────────────────────────────────────────────┤
│ LOCALES: 2 cards → San Bernardo (Eyzaguirre 268) · Buin      │
│  dirección, horario, mapa, botón "Cómo llegar"               │
├──────────────────────────────────────────────────────────────┤
│ FOOTER: logo, links, RRSS (IG), horarios, © Fenix            │
└──────────────────────────────────────────────────────────────┘
```

**Prioridad visual:** 1) H1 + CTA catálogo, 2) categorías, 3) ofertas con precio, 4) locales.
**Mobile:** header colapsa a hamburguesa + carro fijo; categorías 2 col; productos 2 col; CTA WhatsApp flotante.

## 4. Flujo carro → pedido WhatsApp

```
Landing → [+ Agregar] → badge carro actualiza → abre Drawer
Drawer: items (qty ±, quitar) → selecciona local de retiro (San Bernardo | Buin)
      → [Pedir por WhatsApp] → wa.me con mensaje pre-armado:
        "Hola! Quiero pedir para retiro en {local}: 2x Laca HS 1Lt Kit ($55.000)… Total $X"
Estados: carro vacío (ilustración + "Ver ofertas") · qty máx · persiste en memoria de sesión
```

Fase 2: checkout con Webpay + stock en tiempo real por local (se conecta al modelo Prisma del POS: la landing lee `StockLocal`).

## 5. Design system (tokens Tailwind v4)

Identidad derivada del logo: azul grafito sobrio + fuego fénix (rojo→naranja) + blanco.
Tema general **claro** (fondos blanco/gris perla); el navy se usa solo como acento en header topbar, hero, bloque asesoría y footer.

```
--color-navy-950: #0B0F17   acentos oscuros (hero, footer, topbar) y texto principal
--color-navy-900: #121826   superficies sobre oscuro
--color-navy-800: #1C2536   bordes sobre oscuro
--color-fenix-600: #E03A1F  rojo fénix (badges oferta, kickers, hovers)
--color-fenix-500: #FF4D26  primario CTA
--color-fenix-400: #FF7A45  gradiente/hover
--color-flame:     linear-gradient(135°, #E03A1F → #FF7A45 → #FFB347)
--color-lime-400:  #A6E22E  acento secundario (éxito, stock) — guiño al verde del logo
--color-surface:   #FFFFFF  secciones claras
--color-cloud:     #F4F6FB  fondo alterno claro
--color-ink:       #101828  texto sobre claro
Tipografía: Geist (ya instalada) · escala 14/16/18/24/32/44/60 · headings tight, uppercase en labels
Radios: cards 16px · botones 12px · pill 9999px
Sombra: 0 8px 30px rgb(6 11 31 / .12)
```

Contraste verificado: `fenix-500` sobre `navy-950` ≥ 4.5:1 en texto grande; texto body sobre navy usa `#E6EAF5`.

## 6. Componentes clave

```
Button        primary (flame) | secondary (outline claro) | ghost | whatsapp (verde)
ProductCard   imagen · marca (uppercase) · nombre · precio CLP · badge oferta · [+ Agregar]
CategoryCard  icono · nombre · hover eleva + borde flame
CartDrawer    lateral derecha, overlay, líneas + selector local + total + CTA WhatsApp
StoreCard     nombre local · dirección · horario · [Cómo llegar]
SectionTitle  kicker uppercase flame + H2
Header        sticky, blur sobre hero, badge contador carro (aria-live)
```

Accesibilidad: touch targets ≥44px, focus visible, `aria-live` en contador del carro, alt en productos, navegación completa por teclado en drawer (trap + Esc).

## 7. Arquitectura de código (feature-first)

```
app/            layout, page (landing compone secciones), globals.css (tokens)
features/
  catalog/      types.ts · data/products.ts (mock → luego Prisma) · components/
  cart/         store.ts (Zustand) · components/CartDrawer, AddToCartButton
  stores/       data/locations.ts · components/StoreCard
components/     ui compartido (Button, SectionTitle, Container)
lib/            format.ts (CLP), whatsapp.ts (builder del mensaje)
```

El mock de productos replica el shape del futuro modelo Prisma (`sku, nombre, marca, categoria, precioVenta, imagen`) para que el swap a BD sea directo.

## 8. Pendientes / fase 2

Búsqueda con autocompletado, páginas de catálogo y ficha, stock real por local desde el POS, checkout Webpay, SEO local (schema.org LocalBusiness por sucursal), fotos reales de productos.
