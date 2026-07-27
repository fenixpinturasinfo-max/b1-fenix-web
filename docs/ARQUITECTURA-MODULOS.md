# Arquitectura de módulos — B1 Fenix

Mapa objetivo del sistema (estilo ERP). ✅ = construido · 🔜 = por construir.

```
INICIO (KPIs)                                        ✅
INVENTARIO
  ├─ Stock por local (min/max, ubicación, alertas)   ✅
  ├─ Productos (maestro: crear ✅ / editar 🔜 / desactivar 🔜)
  └─ Movimientos (entradas, ajustes, mermas, transf.) ✅
COMPRAS
  ├─ Solicitudes a casa matriz                        ✅
  ├─ Orden de Compra (a proveedor)                    🔜 F2
  ├─ Entrada de Compra / Guía (sube stock + costo)    🔜 F2
  ├─ Factura de Compra (cuentas por pagar)            🔜 F3
  └─ Nota de Crédito (devolución: baja stock y deuda) 🔜 F3
VENTAS
  ├─ POS / Caja / Arqueo                              ✅
  └─ Boletas (+ correo)                               ✅
SOCIOS DE NEGOCIOS                                    🔜 F1
  └─ Ficha única con tipo: CLIENTE | PROVEEDOR | AMBOS
     (RUT, razón social, contacto, dirección, condición de pago)
PRECIOS (lista unificada, márgenes)                   ✅
LOCALES (+ casa matriz)                               ✅
USUARIOS (roles)                                      ✅
REPORTES                                              ✅
```

## Flujo de compras (documentos encadenados)

```
Solicitud (local) ──► Orden de Compra ──► Entrada/Guía ──► Factura ──► [Nota de Crédito]
     PENDIENTE          BORRADOR             ★ AQUÍ SUBE       ABIERTA      (parcial o total)
     DESPACHADA         ENVIADA              EL STOCK y se     PAGADA
     RECHAZADA          RECIBIDA (parcial)   actualiza costo
```

Regla UX: cada documento se **genera desde el anterior** (copia sus líneas), nunca se
re-digita. Una OC puede recibirse en varias guías (recepción parcial).

## Modelos de datos a agregar (Prisma, fase por fase)

### F1 — Socios de Negocios
```prisma
enum TipoSocio { CLIENTE PROVEEDOR AMBOS }
model SocioNegocio {
  id, tipo, rut @unique, razonSocial, nombreFantasia?, giro?,
  email?, telefono?, direccion?, comuna?,
  condicionPago? (CONTADO | 30D | 60D), activo, creadoEn
  ordenesCompra OrdenCompra[]  // como proveedor
  ventas Venta[]?              // como cliente (agregar clienteId? a Venta)
}
```

### F2 — Orden de Compra + Entrada (con Costo Promedio Ponderado)

**Dos caminos desde la OC:**
```
Camino 1: OC → Entrada/Guía (1..n, parcial) → Factura de Compra (referencia entradas)
Camino 2: OC → Factura directa (copia líneas NO recibidas; la factura ACTÚA como recepción)
```
Ambos caminos, al recepcionar: incrementan StockLocal + MovimientoInventario(ENTRADA)
+ recalculan CPP. La OC pasa a RECIBIDA_PARCIAL / RECIBIDA según cantidades.

**Costo Promedio Ponderado (en cada recepción):**
```
CPP nuevo = (stockTotal × CPPactual + cantRecibida × costoCompra) / (stockTotal + cantRecibida)
```
- stockTotal = suma de TODOS los locales (costo unificado, como la lista de precios)
- si stockTotal ≤ 0 → CPP = costoCompra
- redondeo a CLP entero · se guarda en Producto.precioCosto (alimenta margen en Precios)
- ventas / mermas / ajustes / transferencias NO alteran el CPP
- cada línea de entrada guarda su costoUnitario histórico (trazabilidad)

```prisma
enum EstadoOC { BORRADOR ENVIADA RECIBIDA_PARCIAL RECIBIDA CERRADA ANULADA }
model OrdenCompra { correlativo, proveedorId, localDestinoId, estado, lineas[], neto, creadoPor, fechas }
model OrdenCompraLinea { productoId, cantidad, costoUnitario, cantidadRecibida @default(0) }
model EntradaCompra { correlativo, ordenCompraId?, proveedorId, localId, numeroGuia?, lineas[] }
model EntradaCompraLinea { productoId, cantidad, costoUnitario } // ★ recalcula CPP
```

### F3 — Factura de Compra + Nota de Crédito
```prisma
enum EstadoFactura { ABIERTA PAGADA VENCIDA ANULADA }
model FacturaCompra {
  numero, proveedorId, ordenCompraId?, entradaId?,
  esRecepcionDirecta Boolean // true = camino 2: esta factura subió el stock y recalculó CPP
  neto, iva (19%), total, fechaEmision, fechaVencimiento (según condicionPago del socio), estado
}
model NotaCredito { facturaId, motivo, lineas[] } // baja stock (MovimientoInventario) y rebaja deuda
```

## Navegación (sidebar) objetivo

Grupos colapsables: INVENTARIO / COMPRAS / VENTAS / MAESTROS (Socios, Precios, Locales, Usuarios) / REPORTES.
El rol BODEGA gana acceso a Compras (recepción de guías). JEFE_LOCAL ve OC de su local.

## Orden de implementación sugerido

1. **F1 — Socios de Negocios** (base de todo; rápido: CRUD estilo módulo Locales)
2. **F2 — OC + Entrada de Compra** (el mayor valor operativo: stock y costos reales)
3. **F3 — Factura + NC** (control financiero)
4. Reorganizar sidebar en grupos cuando existan ≥2 ítems de Compras.
