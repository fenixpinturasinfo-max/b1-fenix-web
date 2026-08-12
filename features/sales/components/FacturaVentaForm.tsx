"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { emitirFactura, type ActionState } from "../facturaActions";
import { CONDICIONES_PAGO, totalesFactura, vencimientoDesde } from "../factura";
import {
  DescuentoBoton,
  type DescuentoAplicado,
} from "@/features/descuentos/components/DescuentoBoton";
import { montoDesdePorcentaje, type TopeLibre } from "@/lib/descuento";
import { formatCLP } from "@/lib/format";
import {
  EditorLineas,
  nuevaLineaEditor,
  type ArticuloDoc,
  type LineaEditor,
} from "@/components/documento/EditorLineas";

export interface ProductoFactura extends ArticuloDoc {
  /** Precio de lista. Acá se usa como NETO y el IVA se suma encima. */
  precioVenta: number;
}

export interface ClienteFactura {
  id: string;
  nombre: string;
  rut: string;
  condicionPago: string | null;
  /** Descuento pactado (%). Se precarga solo al elegir el cliente. */
  descuentoPorcentaje: number;
}

/** Pedido disponible para copiar o vincular */
export interface PedidoDisponible {
  id: string;
  folio: string;
  clienteId: string | null;
  nombreCliente: string;
  total: number;
  lineas: { productoId: string; cantidad: number }[];
}

const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none transition focus:border-electric-500";

const fmtFecha = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" });

function hoyISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, "0")}`;
}

export function FacturaVentaForm({
  clientes,
  productos,
  locales,
  localFijo,
  stocks,
  pedidos,
  pedidoInicial,
  puedeDescontar,
  tope,
}: {
  clientes: ClienteFactura[];
  productos: ProductoFactura[];
  locales: { id: string; nombre: string }[];
  localFijo: string | null;
  /** stock disponible: productoId → localId → cantidad */
  stocks: Record<string, Record<string, number>>;
  /** pedidos sin facturar del local, para copiar o vincular */
  pedidos: PedidoDisponible[];
  /** cuando se llega desde "Crear factura" en un pedido */
  pedidoInicial?: PedidoDisponible;
  /** Si quien emite ya tiene el permiso, el modal no le pide credenciales de supervisor. */
  puedeDescontar: boolean;
  /** Tramo que el perfil descuenta sin autorización. */
  tope: TopeLibre | null;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await emitirFactura(prev, fd);
      if (res.facturaId) router.push(`/dashboard/ventas/facturas/${res.facturaId}`);
      return res;
    },
    {},
  );

  const [descuento, setDescuento] = useState<DescuentoAplicado | null>(null);
  const [clienteId, setClienteId] = useState(pedidoInicial?.clienteId ?? "");
  const [localId, setLocalId] = useState(localFijo ?? locales[0]?.id ?? "");
  const [pedidoId, setPedidoId] = useState(pedidoInicial?.id ?? "");
  const [fechaEmision, setFechaEmision] = useState(hoyISO);
  const [condicionPago, setCondicionPago] = useState("CONTADO");
  const [lineas, setLineas] = useState<LineaEditor[]>(() =>
    pedidoInicial && pedidoInicial.lineas.length > 0
      ? pedidoInicial.lineas.map((l) => ({
          ...nuevaLineaEditor(),
          productoId: l.productoId,
          cantidad: l.cantidad,
          precio: productos.find((p) => p.id === l.productoId)?.precioVenta ?? 0,
        }))
      : [nuevaLineaEditor()],
  );

  const origen = localFijo ?? localId;
  const porId = new Map(productos.map((p) => [p.id, p]));

  // El precio de lista se muestra como neto: el IVA se agrega en el pie
  const precioDe = (p: ArticuloDoc) => ({
    valor: porId.get(p.id)?.precioVenta ?? 0,
    etiqueta: "Neto",
  });

  const stockDe = (productoId: string) => stocks[productoId]?.[origen] ?? 0;
  const excede = (l: LineaEditor) =>
    l.productoId != null && stockDe(l.productoId) < l.cantidad;

  const completas = lineas.filter((l) => l.productoId);
  const conError = completas.filter(excede);
  const clienteSel = clientes.find((c) => c.id === clienteId);

  // El pactado del cliente es un %: se recalcula solo con cada línea que cambia. No se
  // suma con el manual autorizado: manda el mayor, igual que en el POS y en el servidor.
  const netoSinRebaja = completas.reduce((n, l) => n + l.cantidad * l.precio, 0);
  const rebajaCliente = montoDesdePorcentaje(netoSinRebaja, clienteSel?.descuentoPorcentaje ?? 0);
  const gobiernaCliente = rebajaCliente > 0 && rebajaCliente >= (descuento?.monto ?? 0);
  const { netoBruto, descuento: rebaja, neto, iva, total } = totalesFactura(
    completas.map((l) => ({ cantidad: l.cantidad, precioUnitario: l.precio })),
    Math.max(descuento?.monto ?? 0, rebajaCliente),
  );

  const vence = vencimientoDesde(new Date(`${fechaEmision}T12:00:00`), condicionPago);
  const pedidoSel = pedidos.find((p) => p.id === pedidoId) ?? pedidoInicial;

  // Solo los pedidos del cliente elegido (o sin ficha) tienen sentido para vincular
  const pedidosElegibles = pedidos.filter(
    (p) => !clienteId || p.clienteId === clienteId || p.clienteId === null,
  );

  const puedeEmitir = !pending && completas.length > 0 && conError.length === 0 && !!clienteId;

  const payload = completas.map((l) => ({ productoId: l.productoId!, cantidad: l.cantidad }));

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="lineas" value={JSON.stringify(payload)} />
      {descuento && (
        <>
          <input type="hidden" name="descuento" value={descuento.monto} />
          <input type="hidden" name="valeDescuento" value={descuento.vale} />
          <input type="hidden" name="descuentoMotivo" value={descuento.motivo} />
        </>
      )}
      <input type="hidden" name="clienteId" value={clienteId} />
      <input type="hidden" name="localId" value={origen} />
      <input type="hidden" name="pedidoId" value={pedidoId} />
      <input type="hidden" name="fechaEmision" value={fechaEmision} />
      <input type="hidden" name="condicionPago" value={condicionPago} />

      {pedidoInicial && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-electric-500/30 bg-electric-50 px-5 py-3.5 text-sm">
          <span className="text-lg">📋</span>
          <p className="text-navy-950">
            <b>Copiando desde el pedido {pedidoInicial.folio}</b> de{" "}
            <b>{pedidoInicial.nombreCliente}</b>. Al emitir, el pedido queda facturado y su
            stock sale del inventario: ya no se cobra por el POS.
          </p>
        </div>
      )}

      {/* Aviso del IVA. El pedido es IVA incluido y la factura suma 19% al precio de lista,
          así que los totales no coinciden. Decirlo acá evita la sorpresa al final. */}
      {pedidoSel && total > 0 && total !== pedidoSel.total && (
        <div className="rounded-2xl border border-[#f59e0b]/40 bg-[#f59e0b]/5 px-5 py-3.5 text-sm text-[#b45309]">
          <b>El total no coincide con el del pedido, y es lo esperado.</b> El pedido muestra{" "}
          {formatCLP(pedidoSel.total)} con IVA incluido; la factura toma el precio de lista
          como neto y suma 19% encima, por eso queda en {formatCLP(total)}. Si el cliente
          debe pagar lo mismo que dice el pedido, hay que ajustar las cantidades o el
          criterio de IVA antes de emitir.
        </div>
      )}

      {/* Cabecera del documento */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="fv-cli" className="mb-1 block text-sm font-semibold text-slate-700">
            Cliente *
          </label>
          <select
            id="fv-cli"
            required
            value={clienteId}
            onChange={(e) => {
              setClienteId(e.target.value);
              const c = clientes.find((x) => x.id === e.target.value);
              if (c?.condicionPago) setCondicionPago(c.condicionPago);
              // El pedido elegido puede no pertenecer al cliente nuevo
              setPedidoId("");
            }}
            className={input}
          >
            <option value="">— Selecciona cliente —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          {clienteSel ? (
            <p className="mt-1 font-mono text-xs text-slate-500">
              RUT {clienteSel.rut}
              {clienteSel.descuentoPorcentaje > 0 && (
                <span className="ml-1 rounded-full bg-[#f59e0b]/15 px-2 py-0.5 font-sans font-bold text-[#b45309]">
                  {clienteSel.descuentoPorcentaje}% pactado
                </span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">
              Una factura necesita RUT: no sirve un cliente de paso.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="fv-local" className="mb-1 block text-sm font-semibold text-slate-700">
            Local que emite *
          </label>
          {localFijo ? (
            <input
              disabled
              value={locales.find((l) => l.id === localFijo)?.nombre ?? ""}
              className={`${input} bg-cloud text-slate-500`}
            />
          ) : (
            <select
              id="fv-local"
              value={localId}
              onChange={(e) => setLocalId(e.target.value)}
              className={input}
            >
              {locales.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          )}
          <p className="mt-1 text-xs text-slate-400">De acá sale el stock.</p>
        </div>

        <div>
          <label htmlFor="fv-fecha" className="mb-1 block text-sm font-semibold text-slate-700">
            Fecha de emisión *
          </label>
          <input
            id="fv-fecha"
            type="date"
            required
            max={hoyISO()}
            value={fechaEmision}
            onChange={(e) => setFechaEmision(e.target.value)}
            className={input}
          />
        </div>

        <div>
          <label htmlFor="fv-cond" className="mb-1 block text-sm font-semibold text-slate-700">
            Condición de pago *
          </label>
          <select
            id="fv-cond"
            value={condicionPago}
            onChange={(e) => setCondicionPago(e.target.value)}
            className={input}
          >
            {CONDICIONES_PAGO.map((c) => (
              <option key={c.valor} value={c.valor}>{c.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            {vence ? `Vence el ${fmtFecha.format(vence)}` : "Sin vencimiento"}
          </p>
        </div>

        <div>
          <label htmlFor="fv-folio" className="mb-1 block text-sm font-semibold text-slate-700">
            Folio SII
          </label>
          <input
            id="fv-folio"
            name="folioSii"
            placeholder="Ej: 1245"
            className={input}
          />
          <p className="mt-1 text-xs text-slate-400">
            El del facturador electrónico. Se puede completar después.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="fv-pedido" className="mb-1 block text-sm font-semibold text-slate-700">
            Pedido vinculado
          </label>
          <select
            id="fv-pedido"
            value={pedidoId}
            onChange={(e) => setPedidoId(e.target.value)}
            className={input}
            disabled={!!pedidoInicial}
          >
            <option value="">— Sin pedido —</option>
            {pedidosElegibles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.folio} · {p.nombreCliente} · {formatCLP(p.total)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            Opcional. Al vincularlo, el pedido queda facturado y no se cobra por el POS.
          </p>
        </div>
      </div>

      {/* Líneas del documento (misma grilla que pedido y orden de compra) */}
      <EditorLineas
        productos={productos}
        lineas={lineas}
        onChange={setLineas}
        precioDe={precioDe}
        stockDe={stockDe}
        proyeccionDe={(l) =>
          l.productoId
            ? { valor: stockDe(l.productoId) - l.cantidad, excede: excede(l) }
            : null
        }
        avisoDe={(l) =>
          excede(l)
            ? `stock insuficiente: ${stockDe(l.productoId!)} disponible${stockDe(l.productoId!) === 1 ? "" : "s"} en ${locales.find((x) => x.id === origen)?.nombre ?? "el local"}`
            : null
        }
        etiquetaPrecio="Precio neto"
        precioEditable={false}
      />

      {/* Totales + emisión */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-cloud/60 p-4">
        <input
          name="nota"
          placeholder="Nota / referencia (opcional)"
          className="h-11 min-w-56 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
        />
        <div className="min-w-52">
          {/* El descuento rebaja el neto: el IVA se calcula después, sobre el neto ya
              rebajado. Por eso la base es `netoBruto` y no el total con impuesto. */}
          <DescuentoBoton
            base={netoBruto}
            puedeDescontar={puedeDescontar}
            tope={tope}
            descuentoCliente={rebajaCliente}
            correo={{ contexto: "FACTURA", localId: origen || null, clienteId: clienteId || null }}
            descuento={descuento}
            onCambio={setDescuento}
            etiquetaBase="neto"
          />
        </div>
        <dl className="min-w-52 space-y-1 text-sm">
          {rebaja > 0 && (
            <div className="flex justify-between gap-8">
              <dt className="text-slate-500">Neto s/ desc.</dt>
              <dd className="tabular-nums text-slate-500">{formatCLP(netoBruto)}</dd>
            </div>
          )}
          {rebaja > 0 && (
            <div className="flex justify-between gap-8">
              <dt className="text-[#b45309]">
                {gobiernaCliente
                  ? `Descuento cliente (${clienteSel!.descuentoPorcentaje}%)`
                  : "Descuento"}
              </dt>
              <dd className="tabular-nums text-[#b45309]">−{formatCLP(rebaja)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-8">
            <dt className="text-slate-500">Neto</dt>
            <dd className="font-semibold tabular-nums text-navy-950">{formatCLP(neto)}</dd>
          </div>
          <div className="flex justify-between gap-8">
            <dt className="text-slate-500">IVA 19%</dt>
            <dd className="font-semibold tabular-nums text-navy-950">{formatCLP(iva)}</dd>
          </div>
          <div className="flex justify-between gap-8 border-t border-slate-300 pt-1">
            <dt className="font-bold text-navy-950">Total</dt>
            <dd className="text-lg font-black tabular-nums text-navy-950">{formatCLP(total)}</dd>
          </div>
        </dl>
        <button
          type="submit"
          disabled={!puedeEmitir}
          className="bg-flame h-12 rounded-xl px-6 font-bold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Emitiendo…" : `Emitir factura (${completas.length})`}
        </button>

        <p className="w-full text-xs text-slate-400">
          Al emitir se descuenta el stock del local y se registran los movimientos. Anularla
          después devuelve la mercadería, pero el folio queda usado.
        </p>
        {!clienteId && completas.length > 0 && (
          <p className="w-full text-sm font-semibold text-slate-500">
            Selecciona el cliente para poder emitir.
          </p>
        )}
        {state.error && (
          <p role="alert" className="w-full text-sm font-semibold text-fenix-600">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
