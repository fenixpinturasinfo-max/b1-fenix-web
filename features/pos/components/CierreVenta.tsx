"use client";

import { useEffect, useRef } from "react";
import { EmailBoletaForm } from "./EmailBoletaForm";
import { formatCLP } from "@/lib/format";
import { IconCheck } from "@/components/ui/icons";

export interface VentaCerrada {
  folio: string;
  ventaId: string | null;
  total: number;
  /** Solo efectivo */
  pagoCon: number | null;
  vuelto: number | null;
  medioPago: string;
}

/** Elementos donde una tecla significa otra cosa y no debemos interceptarla */
const INTERACTIVO = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"]);

/**
 * Cierre de la venta: se toma la pantalla por un momento y devuelve al POS.
 *
 * El vuelto va primero y en grande. Es el único dato que el cajero necesita en ese
 * segundo, con el cliente esperando el cambio, y antes se perdía al vaciarse el carro.
 *
 * Este momento tiene que tener salida: mientras el aviso de "venta registrada" se quedaba
 * pegado en el panel, se podía imprimir o enviar por correo la boleta anterior mientras ya
 * se estaba cargando la siguiente.
 */
export function CierreVenta({
  venta,
  onNuevaVenta,
}: {
  venta: VentaCerrada;
  /** Recibe la tecla con que el cajero empezó a escanear, para no perder el primer dígito */
  onNuevaVenta: (charInicial?: string) => void;
}) {
  const dialogo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const enControl = !!el && INTERACTIVO.has(el.tagName);

      // Escape sale siempre, salvo mientras se escribe: ahí se perdería el correo a medias
      if (e.key === "Escape") {
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
        onNuevaVenta();
        return;
      }

      // Enter sobre un botón o enlace es su propia activación: no la pisamos
      if (e.key === "Enter") {
        if (enControl) return;
        e.preventDefault();
        onNuevaVenta();
        return;
      }

      // El cajero pasó al siguiente cliente y ya está escaneando: no perder el primer dígito
      if (!enControl && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onNuevaVenta(e.key);
      }
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onNuevaVenta]);

  // Retener el foco dentro del diálogo. Sin esto un Tab lo lleva al buscador de atrás y
  // el lector de código carga productos detrás del overlay, sin que nadie lo vea.
  // (No se usa aria-hidden en el contenedor del dashboard porque el modal vive dentro
  //  de él y se ocultaría a sí mismo del lector de pantalla.)
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const alEnfocar = (e: FocusEvent) => {
      const caja = dialogo.current;
      if (caja && e.target instanceof Node && !caja.contains(e.target)) {
        caja.querySelector<HTMLElement>("button, a, input")?.focus();
      }
    };
    document.addEventListener("focusin", alEnfocar);
    return () => {
      document.body.style.overflow = previo;
      document.removeEventListener("focusin", alEnfocar);
    };
  }, []);

  const hayVuelto = venta.vuelto !== null;
  const resumenVoz = hayVuelto
    ? `${venta.vuelto! < 0 ? "Falta por cobrar" : "Vuelto"} ${formatCLP(Math.abs(venta.vuelto!))}. Boleta ${venta.folio}.`
    : `Venta registrada por ${formatCLP(venta.total)}. Boleta ${venta.folio}.`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4"
      onClick={() => onNuevaVenta()}
      role="presentation"
    >
      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cierre-venta-titulo"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-6 text-center shadow-2xl"
      >
        <h2 id="cierre-venta-titulo" className="sr-only">
          {resumenVoz}
        </h2>

        {/* role="status" para que el lector de pantalla anuncie el monto, no solo el título */}
        <div role="status">
          {hayVuelto ? (
            <div
              className={`rounded-xl px-4 py-4 ${
                venta.vuelto! < 0 ? "bg-fenix-600/10" : "bg-lime-400/15"
              }`}
            >
              <p
                className={`text-xs font-bold uppercase tracking-wider ${
                  venta.vuelto! < 0 ? "text-fenix-600" : "text-[#4d7c0f]"
                }`}
              >
                {venta.vuelto! < 0 ? "Falta por cobrar" : "Vuelto para el cliente"}
              </p>
              <p
                className={`text-5xl font-black leading-tight tabular-nums ${
                  venta.vuelto! < 0 ? "text-fenix-600" : "text-[#4d7c0f]"
                }`}
              >
                {formatCLP(Math.abs(venta.vuelto!))}
              </p>
              <p className="text-xs text-slate-500">
                Pagó con {formatCLP(venta.pagoCon ?? 0)} · total {formatCLP(venta.total)}
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-lime-400/15 px-4 py-4">
              <p className="flex items-center justify-center gap-2 text-sm font-bold text-[#4d7c0f]">
                <IconCheck size={18} /> Venta registrada
              </p>
              <p className="text-4xl font-black leading-tight tabular-nums text-navy-950">
                {formatCLP(venta.total)}
              </p>
              <p className="text-xs capitalize text-slate-500">
                {venta.medioPago.toLowerCase()}
              </p>
            </div>
          )}
        </div>

        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
          Boleta
          <span className="font-mono text-base font-black text-navy-950">{venta.folio}</span>
        </p>

        <button
          type="button"
          autoFocus
          onClick={() => onNuevaVenta()}
          className="bg-flame mt-4 h-14 w-full rounded-xl text-lg font-black text-white transition hover:opacity-90"
        >
          Nueva venta
        </button>

        {venta.ventaId && (
          <>
            <div className="mt-2 flex gap-2">
              <a
                href={`/dashboard/pos/boletas/${venta.ventaId}?print=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 flex-1 items-center justify-center rounded-xl border-2 border-navy-950 text-sm font-bold text-navy-950 transition hover:bg-navy-950 hover:text-white"
              >
                🖨 Imprimir
              </a>
              <a
                href={`/dashboard/pos/boletas/${venta.ventaId}`}
                className="flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
              >
                Ver boleta
              </a>
            </div>
            <div className="mt-2 text-left">
              <EmailBoletaForm ventaId={venta.ventaId} />
            </div>
          </>
        )}

        <p className="mt-3 text-xs text-slate-400">
          Enter o Esc para la siguiente venta · si escaneas, se abre sola
        </p>
      </div>
    </div>
  );
}

/**
 * Rastro de la venta anterior sobre el carro. Se apaga al agregar el primer producto de la
 * venta siguiente, para que nunca se confunda la boleta vieja con la que se está cobrando.
 */
export function TiraUltimaVenta({
  venta,
  onVerCierre,
  onDescartar,
}: {
  venta: VentaCerrada;
  onVerCierre: () => void;
  onDescartar: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
      <span className="text-[#4d7c0f]">
        <IconCheck size={16} />
      </span>
      <span className="text-slate-500">Última venta</span>
      <span className="font-mono font-bold text-navy-950">{venta.folio}</span>
      <span className="text-slate-400">{formatCLP(venta.total)}</span>
      <span className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onVerCierre}
          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
        >
          Boleta
        </button>
        <button
          type="button"
          onClick={onDescartar}
          aria-label="Ocultar la última venta"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cloud hover:text-navy-950"
        >
          ✕
        </button>
      </span>
    </div>
  );
}
