"use client";

import { useState } from "react";
import Link from "next/link";
import { Paginacion } from "@/components/ui/Paginacion";
import { BuscadorLista, ChipsFiltro, TablaScroll, theadSticky } from "@/components/ui/lista";
import { formatCLP } from "@/lib/format";
import { estadoFacturaVenta, condicionPagoLabel, type EstadoFacturaVenta } from "../factura";

export interface FacturaVentaRow {
  id: string;
  folio: string;
  folioSii: string | null;
  cliente: string;
  local: string;
  pedidoFolio: string | null;
  fechaEmision: string;
  vencimiento: string | null;
  /** Días de atraso: positivo = vencida. null si no aplica */
  atraso: number | null;
  condicionPago: string | null;
  total: number;
  estado: EstadoFacturaVenta;
}

const PAGINA = 12;
type Filtro = "TODAS" | "POR_COBRAR" | "VENCIDAS" | "PAGADAS" | "ANULADAS";

const pasa = (r: FacturaVentaRow, f: Filtro) => {
  if (f === "TODAS") return true;
  if (f === "POR_COBRAR") return r.estado === "ABIERTA";
  // Vencida es un subconjunto de por cobrar, no un estado: una pagada tarde ya no urge
  if (f === "VENCIDAS") return r.estado === "ABIERTA" && (r.atraso ?? -1) > 0;
  if (f === "PAGADAS") return r.estado === "PAGADA";
  return r.estado === "ANULADA";
};

export function FacturasVentaLista({
  rows,
  mostrarLocal,
}: {
  rows: FacturaVentaRow[];
  mostrarLocal: boolean;
}) {
  const [filtro, setFiltro] = useState<Filtro>("POR_COBRAR");
  const [query, setQuery] = useState("");
  const [pagina, setPagina] = useState(1);

  const q = query.trim().toLowerCase();
  const filtrados = rows.filter(
    (r) =>
      pasa(r, filtro) &&
      (!q ||
        r.folio.toLowerCase().includes(q) ||
        (r.folioSii ?? "").toLowerCase().includes(q) ||
        r.cliente.toLowerCase().includes(q) ||
        (r.pedidoFolio ?? "").toLowerCase().includes(q)),
  );
  const visibles = filtrados.slice((pagina - 1) * PAGINA, pagina * PAGINA);

  // Lo que te deben: el número por el que existe esta pantalla
  const porCobrar = rows.filter((r) => r.estado === "ABIERTA");
  const vencido = porCobrar.filter((r) => (r.atraso ?? -1) > 0);
  const montoPorCobrar = porCobrar.reduce((n, r) => n + r.total, 0);
  const montoVencido = vencido.reduce((n, r) => n + r.total, 0);

  const etiquetas: Record<Filtro, string> = {
    TODAS: "Todas",
    POR_COBRAR: "Por cobrar",
    VENCIDAS: "Vencidas",
    PAGADAS: "Pagadas",
    ANULADAS: "Anuladas",
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Por cobrar</p>
          <p className="text-xl font-black tabular-nums text-navy-950">
            {formatCLP(montoPorCobrar)}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {porCobrar.length} factura{porCobrar.length === 1 ? "" : "s"} abierta
            {porCobrar.length === 1 ? "" : "s"}
          </p>
        </div>
        <div
          className={`rounded-2xl border bg-white px-4 py-3 ${
            vencido.length > 0 ? "border-fenix-600/30" : "border-slate-200"
          }`}
        >
          <p className="text-xs text-slate-500">Vencido</p>
          <p
            className={`text-xl font-black tabular-nums ${
              vencido.length > 0 ? "text-fenix-600" : "text-navy-950"
            }`}
          >
            {formatCLP(montoVencido)}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {vencido.length === 0
              ? "Nada atrasado"
              : `${vencido.length} pasó su fecha de pago`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ChipsFiltro<Filtro>
          opciones={(
            ["POR_COBRAR", "VENCIDAS", "PAGADAS", "ANULADAS", "TODAS"] as const
          ).map((f) => ({ valor: f, label: etiquetas[f], n: rows.filter((r) => pasa(r, f)).length }))}
          valor={filtro}
          onChange={(f) => {
            setFiltro(f);
            setPagina(1);
          }}
        />
        <BuscadorLista
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPagina(1);
          }}
          placeholder="Folio, cliente o pedido…"
        />
      </div>

      <TablaScroll>
        <thead className={theadSticky}>
          <tr>
            <th className="px-4 py-2.5">Factura</th>
            <th className="px-4 py-2.5">Cliente</th>
            {mostrarLocal && <th className="px-4 py-2.5">Local</th>}
            <th className="px-4 py-2.5">Pedido</th>
            <th className="px-4 py-2.5">Emisión</th>
            <th className="px-4 py-2.5">Vencimiento</th>
            <th className="px-4 py-2.5 text-right">Total</th>
            <th className="px-4 py-2.5">Estado</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((r) => {
            const badge = estadoFacturaVenta[r.estado];
            const vencida = r.estado === "ABIERTA" && (r.atraso ?? -1) > 0;
            return (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap px-4 py-2">
                  <span className="font-mono font-bold text-navy-950">{r.folio}</span>
                  {r.folioSii && (
                    <span className="block text-xs text-slate-400">SII {r.folioSii}</span>
                  )}
                </td>
                <td className="max-w-56 truncate px-4 py-2 text-slate-600" title={r.cliente}>
                  {r.cliente}
                </td>
                {mostrarLocal && <td className="px-4 py-2 text-slate-600">{r.local}</td>}
                <td className="px-4 py-2 text-slate-500">
                  {r.pedidoFolio ? (
                    <span className="font-mono text-xs">{r.pedidoFolio}</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">{r.fechaEmision}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  {r.vencimiento ? (
                    <>
                      <span className={vencida ? "font-bold text-fenix-600" : "text-slate-600"}>
                        {r.vencimiento}
                      </span>
                      {vencida && (
                        <span className="block text-xs font-bold text-fenix-600">
                          {r.atraso} día{r.atraso === 1 ? "" : "s"} de atraso
                        </span>
                      )}
                      {!vencida && r.condicionPago && (
                        <span className="block text-xs text-slate-400">
                          {condicionPagoLabel[r.condicionPago] ?? r.condicionPago}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-navy-950">
                  {formatCLP(r.total)}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/dashboard/ventas/facturas/${r.id}`}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            );
          })}
          {visibles.length === 0 && (
            <tr>
              <td
                colSpan={mostrarLocal ? 9 : 8}
                className="px-4 py-10 text-center text-sm text-slate-400"
              >
                {rows.length === 0
                  ? "Aún no has emitido facturas de venta. Se usan para clientes empresa que pagan a plazo."
                  : "Sin resultados en este filtro."}
              </td>
            </tr>
          )}
        </tbody>
      </TablaScroll>

      <div className="flex justify-center">
        <Paginacion
          total={filtrados.length}
          pagina={pagina}
          porPagina={PAGINA}
          onChange={setPagina}
        />
      </div>
    </div>
  );
}
