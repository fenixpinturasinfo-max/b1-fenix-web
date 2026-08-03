"use client";

import { useActionState, useState } from "react";
import { registrarDocumentoMovimiento, type ActionState } from "../actions";
import { formatCLP } from "@/lib/format";
import {
  EditorLineas,
  nuevaLineaEditor,
  type ArticuloDoc,
  type LineaEditor,
} from "@/components/documento/EditorLineas";

export interface ProductoMovimiento extends ArticuloDoc {
  costo: number; // CPP vigente
}

type Tipo = "ENTRADA" | "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO" | "MERMA" | "TRANSFERENCIA";

const TIPOS: {
  valor: Tipo;
  label: string;
  glosa: string;
  signo: 1 | -1;
}[] = [
  {
    valor: "ENTRADA",
    label: "Entrada",
    glosa: "Ingreso de stock con costo. Recalcula el costo promedio del artículo.",
    signo: 1,
  },
  {
    valor: "AJUSTE_POSITIVO",
    label: "Ajuste +",
    glosa: "Sobrante detectado en un conteo. No altera el costo promedio.",
    signo: 1,
  },
  {
    valor: "AJUSTE_NEGATIVO",
    label: "Ajuste −",
    glosa: "Faltante detectado en un conteo. No altera el costo promedio.",
    signo: -1,
  },
  {
    valor: "MERMA",
    label: "Merma",
    glosa: "Daño, pérdida o vencimiento. El valorizado es la pérdida a costo.",
    signo: -1,
  },
  {
    valor: "TRANSFERENCIA",
    label: "Transferencia",
    glosa: "Traslado entre locales. Genera un movimiento espejo en el destino.",
    signo: -1,
  },
];

const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none transition focus:border-electric-500";

const fmtDoc = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" });

export function MovementForm({
  productos,
  locales,
  localFijo,
  productoDefault,
  stocks,
}: {
  productos: ProductoMovimiento[];
  locales: { id: string; nombre: string }[];
  /** id del local del usuario (null = rol global, elige) */
  localFijo: string | null;
  /** preselección al venir desde la tabla de stock */
  productoDefault?: string;
  /** stock disponible: productoId → localId → cantidad */
  stocks: Record<string, Record<string, number>>;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    registrarDocumentoMovimiento,
    {},
  );
  const [tipo, setTipo] = useState<Tipo>("ENTRADA");
  const [localId, setLocalId] = useState(localFijo ?? locales[0]?.id ?? "");
  const [localDestinoId, setLocalDestinoId] = useState("");
  const [lineas, setLineas] = useState<LineaEditor[]>(() => [
    productoDefault
      ? {
          ...nuevaLineaEditor(),
          productoId: productoDefault,
          precio: productos.find((p) => p.id === productoDefault)?.costo ?? 0,
        }
      : nuevaLineaEditor(),
  ]);

  const cfg = TIPOS.find((t) => t.valor === tipo)!;
  const esTransferencia = tipo === "TRANSFERENCIA";
  const origenId = localFijo ?? localId;

  // Al registrar con éxito, el documento se limpia para el siguiente.
  // Se ajusta en render (no en un efecto) comparando la identidad del último
  // `state` procesado: así también limpia al repetir un documento idéntico.
  const [okProcesado, setOkProcesado] = useState<ActionState | null>(null);
  if (state.ok && state !== okProcesado) {
    setOkProcesado(state);
    setLineas([nuevaLineaEditor()]);
  }

  const porId = new Map(productos.map((p) => [p.id, p]));
  const stockDe = (productoId: string, local: string) => stocks[productoId]?.[local] ?? 0;

  const precioDe = (p: ArticuloDoc) => ({
    valor: porId.get(p.id)?.costo ?? 0,
    etiqueta: "CPP",
  });

  const excedeStock = (l: LineaEditor) =>
    cfg.signo === -1 && l.productoId != null && stockDe(l.productoId, origenId) < l.cantidad;

  const completas = lineas.filter((l) => l.productoId);
  const conError = completas.filter(excedeStock);
  const unidades = completas.reduce((t, l) => t + l.cantidad, 0);
  const valorizado = completas.reduce((t, l) => t + l.cantidad * l.precio, 0);

  const destinoInvalido = esTransferencia && (!localDestinoId || localDestinoId === origenId);
  const puedeEnviar =
    !pending && completas.length > 0 && conError.length === 0 && !destinoInvalido;

  const payload = completas.map((l) => ({
    productoId: l.productoId!,
    cantidad: l.cantidad,
    costoUnitario: l.precio,
  }));

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="localId" value={origenId} />
      <input type="hidden" name="localDestinoId" value={esTransferencia ? localDestinoId : ""} />
      <input type="hidden" name="lineas" value={JSON.stringify(payload)} />

      {/* Tipo de documento: define la semántica de todo el movimiento */}
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">
          Tipo de documento *
        </span>
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              aria-pressed={tipo === t.valor}
              onClick={() => setTipo(t.valor)}
              className={`h-10 rounded-full border px-4 text-sm font-bold transition ${
                tipo === t.valor
                  ? "border-electric-600 bg-electric-600 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-electric-500 hover:text-electric-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate-400">{cfg.glosa}</p>
      </div>

      {/* Cabecera del documento */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="mov-local" className="mb-1 block text-sm font-semibold text-slate-700">
            Local {esTransferencia ? "de origen" : ""} *
          </label>
          {localFijo ? (
            <input
              disabled
              value={locales.find((l) => l.id === localFijo)?.nombre ?? ""}
              className={`${input} bg-cloud text-slate-500`}
            />
          ) : (
            <select
              id="mov-local"
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

        {esTransferencia && (
          <div>
            <label
              htmlFor="mov-destino"
              className="mb-1 block text-sm font-semibold text-slate-700"
            >
              Local de destino *
            </label>
            <select
              id="mov-destino"
              value={localDestinoId}
              onChange={(e) => setLocalDestinoId(e.target.value)}
              className={input}
            >
              <option value="">— Selecciona —</option>
              {locales
                .filter((l) => l.id !== origenId)
                .map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
            </select>
          </div>
        )}

        <div>
          <span className="mb-1 block text-sm font-semibold text-slate-700">Fecha documento</span>
          <p className="flex h-11 items-center rounded-xl border border-slate-200 bg-cloud/60 px-3 text-sm font-semibold text-slate-500">
            {fmtDoc.format(new Date())}
          </p>
        </div>

        <div>
          <span className="mb-1 block text-sm font-semibold text-slate-700">Efecto en stock</span>
          <p
            className={`flex h-11 items-center rounded-xl border px-3 text-sm font-bold ${
              cfg.signo === 1
                ? "border-lime-400/40 bg-lime-400/10 text-[#4d7c0f]"
                : "border-fenix-600/30 bg-fenix-600/5 text-fenix-600"
            }`}
          >
            {cfg.signo === 1 ? "▲ Suma stock" : "▼ Descuenta stock"}
          </p>
        </div>
      </div>

      {/* Líneas del documento (grilla estándar) */}
      <EditorLineas
        productos={productos}
        lineas={lineas}
        onChange={setLineas}
        precioDe={precioDe}
        stockDe={(id) => stockDe(id, origenId)}
        etiquetaStock={esTransferencia ? "Origen" : "Stock"}
        stockDestinoDe={
          esTransferencia && localDestinoId ? (id) => stockDe(id, localDestinoId) : null
        }
        etiquetaStockDestino="Destino"
        proyeccionDe={(l) =>
          l.productoId
            ? {
                valor: stockDe(l.productoId, origenId) + cfg.signo * l.cantidad,
                excede: excedeStock(l),
              }
            : null
        }
        avisoDe={(l) =>
          excedeStock(l)
            ? `stock insuficiente: ${stockDe(l.productoId!, origenId)} disponible${
                stockDe(l.productoId!, origenId) === 1 ? "" : "s"
              } en ${locales.find((x) => x.id === origenId)?.nombre ?? "el local"}`
            : null
        }
        etiquetaPrecio={tipo === "ENTRADA" ? "Costo unit." : "Costo (CPP)"}
        precioEditable={tipo === "ENTRADA"}
      />

      {/* Totales + envío */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-cloud/60 p-4">
        <input
          name="nota"
          placeholder="Nota / referencia (opcional) — ej: guía 4821, conteo cíclico pasillo 3"
          className="h-11 min-w-56 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
        />
        <dl className="min-w-48 space-y-1 text-sm">
          <div className="flex justify-between gap-8">
            <dt className="text-slate-500">Líneas</dt>
            <dd className="font-semibold tabular-nums text-navy-950">{completas.length}</dd>
          </div>
          <div className="flex justify-between gap-8">
            <dt className="text-slate-500">Unidades</dt>
            <dd
              className={`font-semibold tabular-nums ${
                cfg.signo === 1 ? "text-[#4d7c0f]" : "text-fenix-600"
              }`}
            >
              {cfg.signo === 1 ? "+" : "−"}
              {unidades}
            </dd>
          </div>
          <div className="flex justify-between gap-8 border-t border-slate-300 pt-1">
            <dt className="font-bold text-navy-950">
              {tipo === "MERMA" ? "Pérdida" : "Valorizado"}
            </dt>
            <dd className="text-lg font-black tabular-nums text-navy-950">
              {formatCLP(valorizado)}
            </dd>
          </div>
        </dl>
        <button
          type="submit"
          disabled={!puedeEnviar}
          className="bg-flame h-12 rounded-xl px-6 font-bold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Registrando…" : `Registrar ${cfg.label.toLowerCase()} (${completas.length})`}
        </button>

        {destinoInvalido && completas.length > 0 && (
          <p className="w-full text-sm font-semibold text-slate-500">
            Selecciona el local de destino para continuar.
          </p>
        )}
        {state.error && (
          <p role="alert" className="w-full text-sm font-semibold text-fenix-600">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p role="status" className="w-full text-sm font-semibold text-[#4d7c0f]">
            ✓ {state.ok}
          </p>
        )}
      </div>
    </form>
  );
}
