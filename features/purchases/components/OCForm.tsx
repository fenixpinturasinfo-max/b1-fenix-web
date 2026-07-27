"use client";

import { useActionState, useState } from "react";
import { crearOC, type ActionState } from "../actions";
import { formatCLP } from "@/lib/format";
import {
  EditorLineas,
  nuevaLineaEditor,
  type ArticuloDoc,
  type LineaEditor,
} from "@/components/documento/EditorLineas";

export interface ProductoOC extends ArticuloDoc {
  costo: number; // CPP vigente, sugerencia base
}

const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none transition focus:border-electric-500";

/** YYYY-MM-DD en zona local, con desplazamiento de días */
function fechaISO(masDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + masDias);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const fmtDoc = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" });

export function OCForm({
  proveedores,
  locales,
  productos,
  localFijo,
  stocks,
  preciosCompra,
  inicialProveedorId,
  inicialLineas,
  solicitudIds,
}: {
  proveedores: { id: string; nombre: string }[];
  locales: { id: string; nombre: string }[];
  productos: ProductoOC[];
  localFijo: string | null;
  /** stock disponible: productoId → localId → cantidad */
  stocks: Record<string, Record<string, number>>;
  /** lista de precios de compra: proveedorId → productoId → precio neto */
  preciosCompra: Record<string, Record<string, number>>;
  /** Arrastre desde solicitudes de compra (estilo SAP B1 "copiar a") */
  inicialProveedorId?: string;
  inicialLineas?: { productoId: string; cantidad: number; costoUnitario: number }[];
  solicitudIds?: string[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(crearOC, {});
  const [proveedorId, setProveedorId] = useState(inicialProveedorId ?? "");
  const [localId, setLocalId] = useState(localFijo ?? locales[0]?.id ?? "");
  const [fechaRequerida, setFechaRequerida] = useState(() => fechaISO(7));
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [lineas, setLineas] = useState<LineaEditor[]>(() =>
    inicialLineas && inicialLineas.length > 0
      ? inicialLineas.map((l) => ({
          ...nuevaLineaEditor(),
          productoId: l.productoId,
          cantidad: l.cantidad,
          precio: l.costoUnitario,
        }))
      : [nuevaLineaEditor()],
  );

  const porId = new Map(productos.map((p) => [p.id, p]));

  // Precio sugerido: lista del proveedor seleccionado, si no CPP
  const precioDe = (p: ArticuloDoc) => {
    const deLista = preciosCompra[proveedorId]?.[p.id];
    return deLista != null
      ? { valor: deLista, etiqueta: "Prov." }
      : { valor: porId.get(p.id)?.costo ?? 0, etiqueta: "CPP" };
  };

  const completas = lineas.filter((l) => l.productoId);
  const neto = completas.reduce((t, l) => t + l.cantidad * l.precio, 0);
  const iva = Math.round(neto * 0.19);

  const payload = completas.map((l) => ({
    productoId: l.productoId!,
    cantidad: l.cantidad,
    costoUnitario: l.precio,
  }));

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="lineas" value={JSON.stringify(payload)} />
      <input type="hidden" name="proveedorId" value={proveedorId} />
      <input type="hidden" name="fechaRequerida" value={fechaRequerida} />
      <input type="hidden" name="fechaEntrega" value={fechaEntrega} />
      {!localFijo && <input type="hidden" name="localDestinoId" value={localId} />}
      {localFijo && <input type="hidden" name="localDestinoId" value={localFijo} />}
      {solicitudIds && solicitudIds.length > 0 && (
        <input type="hidden" name="solicitudIds" value={JSON.stringify(solicitudIds)} />
      )}

      {/* Cabecera del documento */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="oc-prov" className="mb-1 block text-sm font-semibold text-slate-700">
            Proveedor *
          </label>
          <select
            id="oc-prov"
            required
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            className={input}
          >
            <option value="">— Selecciona proveedor —</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="oc-local" className="mb-1 block text-sm font-semibold text-slate-700">
            Local de destino *
          </label>
          {localFijo ? (
            <input
              disabled
              value={locales.find((l) => l.id === localFijo)?.nombre ?? ""}
              className={`${input} bg-cloud text-slate-500`}
            />
          ) : (
            <select
              id="oc-local"
              value={localId}
              onChange={(e) => setLocalId(e.target.value)}
              className={input}
            >
              {locales.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <span className="mb-1 block text-sm font-semibold text-slate-700">Fecha documento</span>
          <p className="flex h-11 items-center rounded-xl border border-slate-200 bg-cloud/60 px-3 text-sm font-semibold text-slate-500">
            {fmtDoc.format(new Date())}
          </p>
        </div>
        <div>
          <label htmlFor="oc-fecha" className="mb-1 block text-sm font-semibold text-slate-700">
            Fecha requerida *
          </label>
          <input
            id="oc-fecha"
            type="date"
            required
            min={fechaISO(1)}
            value={fechaRequerida}
            onChange={(e) => setFechaRequerida(e.target.value)}
            className={input}
          />
          <div className="mt-1.5 flex gap-1.5">
            {[3, 7, 15].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setFechaRequerida(fechaISO(d))}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-bold transition ${
                  fechaRequerida === fechaISO(d)
                    ? "border-electric-600 bg-electric-600 text-white"
                    : "border-slate-300 text-slate-500 hover:border-electric-500 hover:text-electric-600"
                }`}
              >
                +{d} días
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="oc-entrega" className="mb-1 block text-sm font-semibold text-slate-700">
            Fecha entrega (proveedor)
          </label>
          <input
            id="oc-entrega"
            type="date"
            value={fechaEntrega}
            onChange={(e) => setFechaEntrega(e.target.value)}
            className={input}
          />
          <p className="mt-1 text-xs text-slate-400">
            La fecha comprometida en la cotización. Vacío si aún no la confirman.
          </p>
        </div>
      </div>

      {/* Líneas del documento (grilla estándar) */}
      <EditorLineas
        productos={productos}
        lineas={lineas}
        onChange={setLineas}
        precioDe={precioDe}
        stockDe={(id) => stocks[id]?.[localFijo ?? localId] ?? 0}
        etiquetaPrecio="Precio"
      />

      {/* Totales + envío */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-cloud/60 p-4">
        <input
          name="nota"
          placeholder="Nota / referencia (opcional)"
          className="h-11 min-w-56 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
        />
        <dl className="min-w-48 space-y-1 text-sm">
          <div className="flex justify-between gap-8">
            <dt className="text-slate-500">Neto</dt>
            <dd className="font-semibold text-navy-950">{formatCLP(neto)}</dd>
          </div>
          <div className="flex justify-between gap-8">
            <dt className="text-slate-500">IVA 19%</dt>
            <dd className="font-semibold text-navy-950">{formatCLP(iva)}</dd>
          </div>
          <div className="flex justify-between gap-8 border-t border-slate-300 pt-1">
            <dt className="font-bold text-navy-950">Total</dt>
            <dd className="text-lg font-black text-navy-950">{formatCLP(neto + iva)}</dd>
          </div>
        </dl>
        <button
          type="submit"
          disabled={pending || completas.length === 0 || !proveedorId}
          className="bg-flame h-12 rounded-xl px-6 font-bold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Creando…" : `Crear orden de compra (${completas.length})`}
        </button>
        {state.error && (
          <p role="alert" className="w-full text-sm font-semibold text-fenix-600">{state.error}</p>
        )}
      </div>
    </form>
  );
}
