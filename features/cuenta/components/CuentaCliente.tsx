"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { anularRetiro, cobrarRetiros, type ActionState } from "../actions";
import { formatCLP } from "@/lib/format";
import { montoDesdePorcentaje, type TopeLibre } from "@/lib/descuento";
import { IVA, CONDICIONES_PAGO } from "@/features/sales/factura";
import {
  DescuentoBoton,
  type DescuentoAplicado,
} from "@/features/descuentos/components/DescuentoBoton";

export interface RetiroAbiertoUi {
  id: string;
  folio: string;
  localId: string;
  localNombre: string;
  total: number;
  nota: string | null;
  creadoPor: string;
  fecha: string;
  lineas: {
    id: string;
    nombre: string;
    sku: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }[];
}

const input =
  "h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none transition focus:border-electric-500";

/**
 * La cuenta del cliente: retiros abiertos seleccionables y el cobro consolidado.
 *
 * El período no lo impone el sistema: se cobra lo que esté marcado, sea la semana, la
 * quincena o el mes. La única regla dura es que un cobro junta retiros de un solo local
 * —el documento sale de un local concreto—, así que al marcar el primero, los de otros
 * locales se apagan.
 */
export function CuentaCliente({
  cliente,
  retiros,
  escribe,
  puedeDescontar,
  tope,
}: {
  cliente: { id: string; nombre: string; descuentoPorcentaje: number; condicionPago: string | null };
  retiros: RetiroAbiertoUi[];
  /** Nivel Total en ventas.cuenta: sin él, la vista es solo consulta. */
  escribe: boolean;
  puedeDescontar: boolean;
  tope: TopeLibre | null;
}) {
  const [seleccion, setSeleccion] = useState<Set<string>>(
    () => new Set(retiros.map((r) => r.id)),
  );
  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  const [tipo, setTipo] = useState<"BOLETA" | "FACTURA">("BOLETA");
  const [medioPago, setMedioPago] = useState("EFECTIVO");
  const [condicionPago, setCondicionPago] = useState(cliente.condicionPago ?? "CONTADO");
  const [descuento, setDescuento] = useState<DescuentoAplicado | null>(null);
  const [anulando, setAnulando] = useState<string | null>(null);

  const [cobro, accionCobro, cobrando] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await cobrarRetiros(prev, fd);
      if (res.ok) {
        // El vale ya se gastó y los retiros cambiaron de estado: partir limpio.
        setDescuento(null);
        setSeleccion(new Set());
      }
      return res;
    },
    {},
  );
  const [anulacion, accionAnular, anulandoPend] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await anularRetiro(prev, fd);
      if (res.ok) setAnulando(null);
      return res;
    },
    {},
  );

  // Tras un cobro o una anulación el servidor re-renderiza con menos retiros: la
  // selección se poda sola contra lo que realmente sigue abierto.
  const abiertosIds = useMemo(() => new Set(retiros.map((r) => r.id)), [retiros]);
  const seleccionadas = retiros.filter((r) => seleccion.has(r.id) && abiertosIds.has(r.id));

  /** Local del cobro en curso: fija qué checkboxes siguen disponibles. */
  const localActivo = seleccionadas[0]?.localId ?? null;
  const hayVariosLocales = new Set(retiros.map((r) => r.localId)).size > 1;

  const base = seleccionadas.reduce((n, r) => n + r.total, 0);
  const descuentoClienteMonto = montoDesdePorcentaje(base, cliente.descuentoPorcentaje);
  const rebaja = Math.min(Math.max(descuento?.monto ?? 0, descuentoClienteMonto), base);
  const gobiernaCliente = descuentoClienteMonto > 0 && descuentoClienteMonto >= (descuento?.monto ?? 0);

  // La misma base con dos lecturas: boleta IVA incluido, factura como neto + 19%.
  const totalBoleta = base - rebaja;
  const netoFactura = base - rebaja;
  const ivaFactura = Math.round(netoFactura * IVA);
  const totalFactura = netoFactura + ivaFactura;

  const toggle = (r: RetiroAbiertoUi) => {
    setSeleccion((s) => {
      const nuevo = new Set(s);
      if (nuevo.has(r.id)) nuevo.delete(r.id);
      else nuevo.add(r.id);
      return nuevo;
    });
  };

  useEffect(() => {
    // Si cambió la base (se marcó/desmarcó un retiro), un descuento manual autorizado
    // para otra base ya no cuenta la historia correcta. Se pide de nuevo.
    setDescuento(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  if (retiros.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-400">
          {cliente.nombre} no tiene retiros abiertos. Los retiros ya cobrados quedan en el
          historial de abajo.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Retiros abiertos */}
      <div className="space-y-3 lg:col-span-2">
        {retiros.map((r) => {
          const marcado = seleccion.has(r.id);
          const bloqueado = !!localActivo && r.localId !== localActivo && !marcado;
          const abierto = expandido.has(r.id);
          return (
            <div
              key={r.id}
              className={`rounded-2xl border bg-white transition ${
                marcado ? "border-electric-500/60" : "border-slate-200"
              } ${bloqueado ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-3 p-4">
                <input
                  type="checkbox"
                  checked={marcado}
                  disabled={bloqueado || !escribe}
                  onChange={() => toggle(r)}
                  title={bloqueado ? "Cobra por local: este retiro es de otro local" : undefined}
                  aria-label={`Incluir ${r.folio} en el cobro`}
                  className="h-5 w-5 shrink-0 accent-[#0e4c92]"
                />
                <button
                  type="button"
                  onClick={() =>
                    setExpandido((s) => {
                      const nuevo = new Set(s);
                      if (nuevo.has(r.id)) nuevo.delete(r.id);
                      else nuevo.add(r.id);
                      return nuevo;
                    })
                  }
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-sm font-bold text-navy-950">
                    <span className="font-mono">{r.folio}</span>
                    <span className="ml-2 font-semibold text-slate-500">{r.fecha}</span>
                    {hayVariosLocales && (
                      <span className="ml-2 rounded-full bg-cloud px-2 py-0.5 text-xs font-bold text-slate-500">
                        {r.localNombre}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {r.lineas.length} línea{r.lineas.length === 1 ? "" : "s"} · registró{" "}
                    {r.creadoPor}
                    {r.nota ? ` · ${r.nota}` : ""} · {abierto ? "ocultar ▲" : "ver detalle ▼"}
                  </p>
                </button>
                <span className="shrink-0 text-sm font-black tabular-nums text-navy-950">
                  {formatCLP(r.total)}
                </span>
                {escribe && (
                  <button
                    type="button"
                    onClick={() => setAnulando(anulando === r.id ? null : r.id)}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-slate-400 transition hover:bg-fenix-600/10 hover:text-fenix-600"
                  >
                    Anular
                  </button>
                )}
              </div>

              {abierto && (
                <ul className="border-t border-slate-100 px-4 py-2 text-sm">
                  {r.lineas.map((l) => (
                    <li key={l.id} className="flex items-baseline justify-between gap-3 py-1">
                      <span className="min-w-0 truncate text-slate-600">
                        {l.cantidad} × {l.nombre}{" "}
                        <span className="font-mono text-xs text-slate-400">{l.sku}</span>
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatCLP(l.precioUnitario)} c/u
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-navy-950">
                        {formatCLP(l.subtotal)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {anulando === r.id && (
                <form
                  action={accionAnular}
                  className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-fenix-600/5 px-4 py-3"
                >
                  <input type="hidden" name="retiroId" value={r.id} />
                  <input
                    name="motivo"
                    required
                    minLength={5}
                    placeholder="Motivo (devolvió la mercadería, error de digitación…)"
                    className={`${input} h-10 min-w-56 flex-1`}
                  />
                  <button
                    type="submit"
                    disabled={anulandoPend}
                    className="h-10 rounded-xl bg-fenix-600 px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                  >
                    {anulandoPend ? "Anulando…" : "Anular y devolver stock"}
                  </button>
                </form>
              )}
            </div>
          );
        })}
        {anulacion.error && (
          <p role="alert" className="text-sm font-semibold text-fenix-600">{anulacion.error}</p>
        )}
        {anulacion.ok && (
          <p role="status" className="text-sm font-semibold text-[#4d7c0f]">✅ {anulacion.ok}</p>
        )}
      </div>

      {/* Cobro consolidado */}
      <div className="h-fit rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-4">
        <h2 className="text-lg font-bold text-navy-950">Cobrar lo seleccionado</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {seleccionadas.length} de {retiros.length} retiro{retiros.length === 1 ? "" : "s"} ·
          el stock no se vuelve a mover: salió con cada retiro.
        </p>

        <div className="mt-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Consumo a precios congelados</span>
            <span className="font-semibold tabular-nums text-navy-950">{formatCLP(base)}</span>
          </div>
          {rebaja > 0 && (
            <div className="flex justify-between text-[#b45309]">
              <span>
                {gobiernaCliente
                  ? `Descuento cliente (${cliente.descuentoPorcentaje}%)`
                  : "Descuento autorizado"}
              </span>
              <span className="font-semibold tabular-nums">−{formatCLP(rebaja)}</span>
            </div>
          )}
          {tipo === "FACTURA" && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">Neto</span>
                <span className="tabular-nums text-navy-950">{formatCLP(netoFactura)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">IVA 19%</span>
                <span className="tabular-nums text-navy-950">{formatCLP(ivaFactura)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base">
            <span className="font-bold text-navy-950">Total</span>
            <span className="font-black tabular-nums text-navy-950">
              {formatCLP(tipo === "FACTURA" ? totalFactura : totalBoleta)}
            </span>
          </div>
          {tipo === "FACTURA" && (
            <p className="pt-1 text-xs text-slate-400">
              La factura toma el precio congelado como neto y suma 19%, igual que el resto
              del sistema.
            </p>
          )}
        </div>

        {escribe && (
          <>
            <div className="mt-4">
              {/* Fuera del formulario de cobro: el modal del descuento trae el suyo. */}
              <DescuentoBoton
                base={base}
                puedeDescontar={puedeDescontar}
                tope={tope}
                descuentoCliente={descuentoClienteMonto}
                correo={{
                  contexto: tipo === "FACTURA" ? "FACTURA" : "POS",
                  localId: localActivo,
                  clienteId: cliente.id,
                }}
                descuento={descuento}
                onCambio={setDescuento}
                etiquetaBase={tipo === "FACTURA" ? "neto" : "total"}
              />
            </div>

            <form action={accionCobro} className="space-y-3">
              <input type="hidden" name="clienteId" value={cliente.id} />
              <input type="hidden" name="tipo" value={tipo} />
              <input
                type="hidden"
                name="retiroIds"
                value={JSON.stringify(seleccionadas.map((r) => r.id))}
              />
              {descuento && (
                <>
                  <input type="hidden" name="descuento" value={descuento.monto} />
                  <input type="hidden" name="valeDescuento" value={descuento.vale} />
                  <input type="hidden" name="descuentoMotivo" value={descuento.motivo} />
                </>
              )}

              <div className="flex gap-2" role="radiogroup" aria-label="Tipo de documento">
                {(["BOLETA", "FACTURA"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    aria-pressed={tipo === t}
                    className={`h-10 flex-1 rounded-xl text-sm font-bold transition ${
                      tipo === t
                        ? "bg-electric-600 text-white"
                        : "border border-slate-300 bg-white text-slate-600 hover:border-electric-500"
                    }`}
                  >
                    {t === "BOLETA" ? "Boleta" : "Factura"}
                  </button>
                ))}
              </div>

              {tipo === "BOLETA" ? (
                <div>
                  <label htmlFor="cc-medio" className="mb-1 block text-sm font-semibold text-slate-700">
                    Medio de pago
                  </label>
                  <select
                    id="cc-medio"
                    name="medioPago"
                    value={medioPago}
                    onChange={(e) => setMedioPago(e.target.value)}
                    className={`${input} w-full`}
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="DEBITO">Débito</option>
                    <option value="CREDITO">Crédito</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                  </select>
                  {medioPago === "EFECTIVO" && (
                    <p className="mt-1 text-xs text-slate-400">
                      El efectivo exige tu caja abierta en el local de los retiros: entra al
                      arqueo del turno.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label htmlFor="cc-cond" className="mb-1 block text-sm font-semibold text-slate-700">
                    Condición de pago
                  </label>
                  <select
                    id="cc-cond"
                    name="condicionPago"
                    value={condicionPago}
                    onChange={(e) => setCondicionPago(e.target.value)}
                    className={`${input} w-full`}
                  >
                    {CONDICIONES_PAGO.map((c) => (
                      <option key={c.valor} value={c.valor}>{c.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {cobro.error && (
                <p role="alert" className="text-sm font-semibold text-fenix-600">{cobro.error}</p>
              )}
              {cobro.ok && (
                <p role="status" className="text-sm font-semibold text-[#4d7c0f]">✅ {cobro.ok}</p>
              )}

              <button
                type="submit"
                disabled={cobrando || seleccionadas.length === 0}
                className="bg-flame h-12 w-full rounded-xl font-black text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {cobrando
                  ? "Generando…"
                  : tipo === "BOLETA"
                    ? `Generar boleta · ${formatCLP(totalBoleta)}`
                    : `Generar factura · ${formatCLP(totalFactura)}`}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
