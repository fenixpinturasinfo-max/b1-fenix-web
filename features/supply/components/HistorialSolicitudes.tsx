"use client";

import { useActionState, useEffect, useState } from "react";
import {
  actualizarSolicitud,
  eliminarSolicitudes,
  enviarCotizacion,
  rechazarSolicitudes,
  type ActionState,
} from "../actions";
import { formatCLP } from "@/lib/format";
import { Paginacion } from "@/components/ui/Paginacion";
import { IconTrash } from "@/components/ui/icons";

export interface LineaDoc {
  id: string;
  producto: string;
  sku: string;
  local: string;
  cantidad: number;
  precio: number | null; // neto unitario
  estado: string;
  resueltoPor: string | null;
  canResolve: boolean;
  canDelete: boolean;
  esProveedor: boolean;
}

export interface DocSolicitud {
  key: string;
  folio: string; // "SOL-000001" o "—"
  fecha: string; // ya formateada
  proveedor: string | null;
  proveedorId: string | null;
  proveedorEmail: string | null;
  local: string; // local de entrega (cabecera del documento)
  solicitante: string;
  estado: string; // PENDIENTE | DESPACHADA | RECHAZADA | PARCIAL
  totalNeto: number | null;
  fechaRequerida: string | null;
  fechaRequeridaISO: string | null; // YYYY-MM-DD para el input date
  oc: { id: string; folio: string; recibida: boolean } | null;
  lineas: LineaDoc[];
}

/**
 * Badge del documento: si tiene OC, el estado real lo dicta la OC
 * (por ingresar hasta que se recepciona la mercadería).
 */
function badgeDoc(d: Pick<DocSolicitud, "estado" | "oc">): { label: string; cls: string } {
  if (d.oc) {
    return d.oc.recibida
      ? { label: "Ingresada", cls: "bg-lime-400/15 text-[#4d7c0f]" }
      : { label: "En OC · por ingresar", cls: "bg-electric-50 text-electric-600" };
  }
  return estadoBadge[d.estado] ?? estadoBadge.PENDIENTE;
}

const estadoBadge: Record<string, { label: string; cls: string }> = {
  PENDIENTE: { label: "Pendiente", cls: "bg-[#f59e0b]/15 text-[#b45309]" },
  COTIZADA: { label: "Cotizada", cls: "bg-electric-50 text-electric-600" },
  DESPACHADA: { label: "Despachada", cls: "bg-lime-400/15 text-[#4d7c0f]" },
  RECHAZADA: { label: "Rechazada", cls: "bg-fenix-600/10 text-fenix-600" },
  PARCIAL: { label: "Parcial", cls: "bg-navy-950/5 text-navy-950" },
};

/** Línea aún abierta (editable, rechazable, copiable a OC) */
const abiertaLinea = (estado: string) => estado === "PENDIENTE" || estado === "COTIZADA";

const PAGINA = 10;

/** Botón eliminar (línea o documento completo) con confirmación */
function BotonEliminar({ ids, etiqueta }: { ids: string[]; etiqueta?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    eliminarSolicitudes,
    {},
  );
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm(
            ids.length === 1
              ? "¿Eliminar esta línea de la solicitud?"
              : `¿Eliminar la solicitud completa (${ids.length} líneas)?`,
          )
        )
          e.preventDefault();
      }}
      className="inline-flex items-center gap-2"
    >
      <input type="hidden" name="ids" value={JSON.stringify(ids)} />
      <button
        type="submit"
        disabled={pending}
        aria-label={etiqueta ?? "Eliminar línea"}
        className={
          etiqueta
            ? "flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-500 transition hover:border-fenix-500 hover:text-fenix-600 disabled:opacity-50"
            : "rounded-lg p-2 text-slate-400 transition hover:bg-fenix-600/10 hover:text-fenix-600 disabled:opacity-50"
        }
      >
        <IconTrash size={15} />
        {etiqueta}
      </button>
      {state.error && (
        <span className="text-xs font-semibold text-fenix-600">{state.error}</span>
      )}
    </form>
  );
}

/** Rechaza todas las líneas pendientes del documento (proveedor no cotiza, se desiste, etc.) */
function BotonRechazar({ ids }: { ids: string[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    rechazarSolicitudes,
    {},
  );
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("¿Rechazar las líneas pendientes de esta solicitud?"))
          e.preventDefault();
      }}
      className="inline-flex items-center gap-2"
    >
      <input type="hidden" name="ids" value={JSON.stringify(ids)} />
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-600 transition hover:border-fenix-500 hover:text-fenix-600 disabled:opacity-50"
      >
        Rechazar solicitud
      </button>
      {state.error && (
        <span className="text-xs font-semibold text-fenix-600">{state.error}</span>
      )}
    </form>
  );
}

/** Enviar cotización por correo al proveedor (desde el modal del documento) */
function EnviarCotizacionBloque({
  proveedorId,
  email,
}: {
  proveedorId: string;
  email: string | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(enviarCotizacion, {});
  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3"
    >
      <input type="hidden" name="proveedorId" value={proveedorId} />
      <div className="min-w-52 flex-1">
        <label className="mb-1 block text-xs font-semibold text-slate-600">
          Correo del proveedor
        </label>
        <input
          name="email"
          type="email"
          required
          defaultValue={email ?? ""}
          placeholder="ventas@proveedor.cl"
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
        />
      </div>
      <div className="min-w-52 flex-[2]">
        <label className="mb-1 block text-xs font-semibold text-slate-600">
          Comentario (opcional)
        </label>
        <input
          name="comentario"
          maxLength={500}
          placeholder="Ej: confirmar disponibilidad antes del viernes"
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-10 whitespace-nowrap rounded-lg bg-electric-600 px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Enviando…" : "✉ Enviar cotización"}
      </button>
      {state.error && (
        <p role="alert" className="w-full text-xs font-semibold text-fenix-600">{state.error}</p>
      )}
      {state.ok && (
        <p role="status" className="w-full text-xs font-semibold text-[#4d7c0f]">✅ {state.ok}</p>
      )}
    </form>
  );
}

/** Modal con el documento completo: cabecera, todas las líneas y acciones */
function SolicitudModal({ doc, onClose }: { doc: DocSolicitud; onClose: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    actualizarSolicitud,
    {},
  );
  const badge = badgeDoc(doc);
  const editables = doc.lineas.filter(
    (l) => abiertaLinea(l.estado) && l.canDelete && !doc.oc,
  );
  const esEditable = (l: LineaDoc) => editables.some((e) => e.id === l.id);

  const [valores, setValores] = useState<Record<string, { cantidad: number; precio: number }>>(
    () =>
      Object.fromEntries(
        editables.map((l) => [l.id, { cantidad: l.cantidad, precio: l.precio ?? 0 }]),
      ),
  );
  const [fecha, setFecha] = useState(doc.fechaRequeridaISO ?? "");

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  // Total del documento con los valores en edición
  const neto = doc.lineas.reduce((t, l) => {
    const v = valores[l.id];
    const precio = v ? v.precio : l.precio ?? 0;
    const cantidad = v ? v.cantidad : l.cantidad;
    return t + precio * cantidad;
  }, 0);
  const iva = Math.round(neto * 0.19);

  const payload = editables.map((l) => ({
    id: l.id,
    cantidad: valores[l.id]?.cantidad ?? l.cantidad,
    precio: valores[l.id]?.precio ?? l.precio,
  }));

  const inputMini =
    "h-8 rounded-lg border border-slate-300 bg-white text-navy-950 outline-none focus:border-electric-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Solicitud ${doc.folio}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        {/* Cabecera del documento */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-mono text-xl font-black text-navy-950">{doc.folio}</h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.cls}`}>
                {badge.label}
              </span>
              {doc.oc && (
                <a
                  href={`/dashboard/compras/${doc.oc.id}`}
                  className="font-mono text-xs font-bold text-electric-600 hover:underline"
                >
                  → {doc.oc.folio}
                </a>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {doc.proveedor ? `🚚 ${doc.proveedor} · ` : ""}📍 Entregar en{" "}
              <b className="text-navy-950">{doc.local}</b> · creada el {doc.fecha} por{" "}
              {doc.solicitante} ·{" "}
              <b className="text-navy-950">
                {doc.lineas.length} línea{doc.lineas.length === 1 ? "" : "s"}
              </b>
              {doc.oc && " · copiada a OC (solo lectura)"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cloud hover:text-navy-950"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Fecha requerida */}
          <div className="max-w-56">
            <label
              htmlFor={`doc-fecha-${doc.key}`}
              className="mb-1 block text-sm font-semibold text-slate-700"
            >
              Fecha requerida
            </label>
            {editables.length > 0 ? (
              <input
                id={`doc-fecha-${doc.key}`}
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={`${inputMini} w-full px-3 text-sm`}
              />
            ) : (
              <p className="flex h-10 items-center rounded-lg border border-slate-200 bg-cloud/60 px-3 text-sm font-semibold text-slate-500">
                {doc.fechaRequerida ?? "—"}
              </p>
            )}
          </div>

          {/* Todas las líneas del documento */}
          <div className="max-h-[45vh] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-cloud/90 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2 text-center">Cant.</th>
                  <th className="px-3 py-2 text-right">Precio (neto)</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {doc.lineas.map((l) => {
                  const editable = esEditable(l);
                  const v = valores[l.id] ?? { cantidad: l.cantidad, precio: l.precio ?? 0 };
                  const lb = doc.oc ? badge : estadoBadge[l.estado] ?? estadoBadge.PENDIENTE;
                  return (
                    <tr key={l.id} className="border-t border-slate-100">
                      <td className="max-w-64 px-3 py-1.5">
                        <p className="truncate text-[13px] font-semibold leading-tight text-navy-950" title={l.producto}>
                          {l.producto}
                        </p>
                        <p className="font-mono text-[11px] text-slate-400">{l.sku}</p>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {editable ? (
                          <input
                            type="number"
                            min={1}
                            value={v.cantidad}
                            onChange={(e) =>
                              setValores((s) => ({
                                ...s,
                                [l.id]: {
                                  ...v,
                                  cantidad: Math.max(1, Math.trunc(Number(e.target.value)) || 1),
                                },
                              }))
                            }
                            aria-label={`Cantidad de ${l.producto}`}
                            className={`${inputMini} mx-auto block w-14 text-center text-xs font-bold`}
                          />
                        ) : (
                          <span className="font-bold text-navy-950">{l.cantidad}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {editable ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatCLP(v.precio)}
                            onChange={(e) => {
                              const precio = Number(e.target.value.replace(/[^\d]/g, "")) || 0;
                              setValores((s) => ({ ...s, [l.id]: { ...v, precio } }));
                            }}
                            aria-label={`Precio de ${l.producto}`}
                            className={`${inputMini} ml-auto block w-24 text-right text-xs font-semibold tabular-nums`}
                          />
                        ) : (
                          <span className="tabular-nums text-slate-600">
                            {l.precio != null ? formatCLP(l.precio) : "—"}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right text-[13px] font-bold tabular-nums text-navy-950">
                        {formatCLP(v.cantidad * v.precio)}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${lb.cls}`}
                        >
                          {lb.label}
                        </span>
                        {l.resueltoPor && (
                          <p className="mt-0.5 text-[11px] text-slate-400">por {l.resueltoPor}</p>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-end gap-1">
                          {editable && <BotonEliminar ids={[l.id]} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cotización y copia a OC (documento abierto con proveedor) */}
          {!doc.oc && doc.proveedorId && editables.length > 0 && (
            <div className="space-y-2">
              <EnviarCotizacionBloque proveedorId={doc.proveedorId} email={doc.proveedorEmail} />
              <p className="text-[11px] text-slate-400">
                El correo incluye todas las líneas abiertas de este proveedor. Al enviarlo, la
                solicitud pasa a <b>Cotizada</b>.
              </p>
            </div>
          )}

          {/* Pie: totales + acciones del documento */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-cloud/60 p-4">
            <dl className="space-y-0.5 text-sm">
              <div className="flex justify-between gap-8">
                <dt className="text-slate-500">Neto</dt>
                <dd className="font-semibold tabular-nums text-navy-950">{formatCLP(neto)}</dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-slate-500">IVA 19%</dt>
                <dd className="font-semibold tabular-nums text-navy-950">{formatCLP(iva)}</dd>
              </div>
              <div className="flex justify-between gap-8 border-t border-slate-300 pt-0.5">
                <dt className="font-bold text-navy-950">Total</dt>
                <dd className="font-black tabular-nums text-navy-950">{formatCLP(neto + iva)}</dd>
              </div>
            </dl>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!doc.oc && doc.proveedorId && editables.length > 0 && (
                <a
                  href={`/dashboard/compras/nueva?proveedor=${doc.proveedorId}`}
                  className="flex h-11 items-center rounded-xl border-2 border-electric-600 px-4 text-sm font-bold text-electric-600 transition hover:bg-electric-600 hover:text-white"
                >
                  → Copiar a OC
                </a>
              )}
              {editables.length > 0 && (
                <BotonRechazar ids={editables.map((l) => l.id)} />
              )}
              {!doc.oc &&
                doc.lineas.length > 0 &&
                doc.lineas.every((l) => abiertaLinea(l.estado) && l.canDelete) && (
                  <BotonEliminar
                    ids={doc.lineas.map((l) => l.id)}
                    etiqueta="Eliminar solicitud"
                  />
                )}
              {editables.length > 0 && (
                <form action={action} className="inline">
                  <input type="hidden" name="lineas" value={JSON.stringify(payload)} />
                  <input type="hidden" name="fechaRequerida" value={fecha} />
                  <button
                    type="submit"
                    disabled={pending}
                    className="bg-flame h-11 rounded-xl px-6 font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                  >
                    {pending ? "Guardando…" : "Guardar cambios"}
                  </button>
                </form>
              )}
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-600"
              >
                Cerrar
              </button>
            </div>
            {state.error && (
              <p role="alert" className="w-full text-sm font-semibold text-fenix-600">
                {state.error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HistorialSolicitudes({
  docs,
  esCompra,
  filtroInicial = "TODAS",
}: {
  docs: DocSolicitud[];
  esCompra: boolean;
  /** Prefiltro al entrar desde el dashboard (?estado=PENDIENTE) */
  filtroInicial?: string;
}) {
  const [filtro, setFiltro] = useState<string>(filtroInicial);
  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);

  const q = query.trim().toLowerCase();
  const filtrados = docs.filter((d) => {
    if (filtro !== "TODAS" && d.estado !== filtro) return false;
    if (
      q &&
      !d.folio.toLowerCase().includes(q) &&
      !(d.proveedor ?? "").toLowerCase().includes(q) &&
      !d.lineas.some(
        (l) => l.producto.toLowerCase().includes(q) || l.sku.toLowerCase().includes(q),
      )
    )
      return false;
    return true;
  });
  const visibles = filtrados.slice((pagina - 1) * PAGINA, pagina * PAGINA);

  const nDe = (estado: string) =>
    estado === "TODAS" ? docs.length : docs.filter((d) => d.estado === estado).length;

  const chips: [string, string][] = [
    ["TODAS", "Todas"],
    ["PENDIENTE", "Pendientes"],
    ["COTIZADA", "Cotizadas"],
    ["DESPACHADA", "Despachadas"],
    ["RECHAZADA", "Rechazadas"],
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-lg font-bold text-navy-950">Historial</h2>
        {chips.map(([valor, label]) => (
          <button
            key={valor}
            type="button"
            onClick={() => {
              setFiltro(valor);
              setPagina(1);
            }}
            className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition ${
              filtro === valor
                ? "bg-electric-600 text-white"
                : "border border-slate-300 bg-white text-slate-600 hover:border-electric-500"
            }`}
          >
            {label}
            <span
              className={`rounded-full px-1.5 text-xs ${
                filtro === valor ? "bg-white/20" : "bg-cloud"
              }`}
            >
              {nDe(valor)}
            </span>
          </button>
        ))}
        <input
          type="search"
          placeholder="Folio, proveedor o producto…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPagina(1);
          }}
          className="ml-auto h-10 w-full max-w-64 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-navy-950 outline-none focus:border-electric-500"
        />
      </div>

      <div className="space-y-2">
        {visibles.map((d) => {
          const badge = badgeDoc(d);
          const unidades = d.lineas.reduce((n, l) => n + l.cantidad, 0);
          return (
            <article key={d.key} className="rounded-2xl border border-slate-200 bg-white transition hover:border-electric-500">
              <button
                type="button"
                onClick={() => setAbierto(d.key)}
                title="Abrir solicitud"
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 text-left"
              >
                <span className="w-28 font-mono text-sm font-bold text-navy-950">{d.folio}</span>
                <span className="w-36 text-sm text-slate-500">{d.fecha}</span>
                {esCompra && (
                  <span className="min-w-32 flex-1 truncate text-sm font-semibold text-navy-950">
                    🚚 {d.proveedor ?? "—"}
                  </span>
                )}
                <span className="text-sm text-slate-500">
                  {d.lineas.length} línea{d.lineas.length === 1 ? "" : "s"} · {unidades} un.
                </span>
                {esCompra && d.totalNeto !== null && (
                  <span className="text-sm font-bold tabular-nums text-navy-950">
                    {formatCLP(d.totalNeto)}{" "}
                    <span className="font-normal text-slate-400">neto</span>
                  </span>
                )}
                {esCompra && d.fechaRequerida && (
                  <span className="text-xs text-slate-500">📦 {d.fechaRequerida}</span>
                )}
                {d.oc && (
                  <span className="font-mono text-xs font-bold text-electric-600">
                    → {d.oc.folio}
                  </span>
                )}
                <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-bold ${badge.cls}`}>
                  {badge.label}
                </span>
              </button>
            </article>
          );
        })}

        {visibles.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white py-8 text-center text-sm text-slate-400">
            {docs.length === 0
              ? "Aún no hay solicitudes."
              : "Sin resultados para el filtro actual."}
          </p>
        )}
      </div>

      <div className="flex justify-center">
        <Paginacion
          total={filtrados.length}
          pagina={pagina}
          porPagina={PAGINA}
          onChange={setPagina}
        />
      </div>

      {/* Modal con el documento completo */}
      {abierto &&
        (() => {
          const doc = docs.find((d) => d.key === abierto);
          return doc ? <SolicitudModal doc={doc} onClose={() => setAbierto(null)} /> : null;
        })()}
    </section>
  );
}
