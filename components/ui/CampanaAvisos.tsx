"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
// Desde `aviso` y NO desde `avisos`: este último consulta la base, e importarlo acá
// arrastraría Prisma y el driver de Postgres al bundle del navegador.
import {
  COOKIE_AVISOS_LEIDOS,
  estaSilenciado,
  type Aviso,
} from "@/features/dashboard/aviso";
import { tonoChip, tonoTexto } from "./tonos";

/**
 * Avisos de la barra superior.
 *
 * No son notificaciones guardadas en una tabla: se derivan del trabajo pendiente en cada
 * navegación. Marcar leído **silencia hasta que el número crezca**, no oculta para siempre:
 * si silenciás "2 facturas vencidas" y aparece una tercera, el aviso vuelve. Sin esa regla,
 * un vencido quedaría enterrado justamente cuando más importa.
 *
 * Lo silenciado vive en una cookie, igual que la preferencia de tema. Se escribe desde el
 * cliente para que el panel reaccione al instante; el próximo render del servidor lee la
 * misma cookie y coincide, así que no hay parpadeo.
 */
const UN_ANIO = 60 * 60 * 24 * 365;

/** Persiste los silenciados. Fuera del componente: escribir el documento no es render. */
function escribirCookie(leidos: Record<string, number>) {
  document.cookie = `${COOKIE_AVISOS_LEIDOS}=${encodeURIComponent(
    JSON.stringify(leidos),
  )}; path=/; max-age=${UN_ANIO}; samesite=lax`;
}

export function CampanaAvisos({
  avisos,
  leidosIniciales,
}: {
  avisos: Aviso[];
  leidosIniciales: Record<string, number>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [leidos, setLeidos] = useState(leidosIniciales);
  const [verSilenciados, setVerSilenciados] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const guardar = (siguiente: Record<string, number>) => {
    setLeidos(siguiente);
    escribirCookie(siguiente);
  };

  const silenciar = (a: Aviso) => guardar({ ...leidos, [a.id]: a.n });
  const silenciarTodos = () =>
    guardar({ ...leidos, ...Object.fromEntries(avisos.map((a) => [a.id, a.n])) });
  const reactivar = () => {
    setVerSilenciados(false);
    guardar({});
  };

  const activos = avisos.filter((a) => !estaSilenciado(a, leidos));
  const silenciados = avisos.filter((a) => estaSilenciado(a, leidos));
  const enPanel = verSilenciados ? avisos : activos;

  const total = activos.reduce((n, a) => n + a.n, 0);
  const critico = activos.some((a) => a.tono === "critico");

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={
          total === 0
            ? "Avisos: no hay pendientes"
            : `Avisos: ${total} pendiente${total === 1 ? "" : "s"}`
        }
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {total > 0 && (
          // El número, no solo un punto: "3" y "17" piden reacciones distintas
          <span
            className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white ${
              critico ? "bg-fenix-600" : "bg-electric-600"
            }`}
          >
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Avisos"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-bold text-navy-950">Pendientes</p>
            {activos.length > 0 && (
              <button
                type="button"
                onClick={silenciarTodos}
                className="rounded-lg px-2 py-1 text-xs font-bold text-electric-600 transition hover:bg-electric-50"
              >
                Marcar todo leído
              </button>
            )}
          </div>

          {enPanel.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-bold text-[#4d7c0f]">✓ Todo al día</p>
              <p className="mt-1 text-xs text-slate-400">
                {silenciados.length > 0
                  ? "Lo que quedaba ya lo marcaste como leído."
                  : "Nada que requiera tu atención en este momento."}
              </p>
            </div>
          ) : (
            <ul className="max-h-96 overflow-auto">
              {enPanel.map((a) => {
                const dormido = estaSilenciado(a, leidos);
                return (
                  <li
                    key={a.id}
                    className={`flex items-start border-b border-slate-100 last:border-0 ${
                      dormido ? "opacity-50" : ""
                    }`}
                  >
                    <Link
                      href={a.href}
                      onClick={() => setAbierto(false)}
                      className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 transition hover:bg-cloud/60"
                    >
                      <span
                        className={`mt-0.5 flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-xs font-black ${tonoChip[a.tono]}`}
                      >
                        {a.n}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-sm font-bold ${tonoTexto[a.tono]}`}>
                          {a.titulo}
                        </span>
                        <span className="block text-xs text-slate-500">{a.descripcion}</span>
                      </span>
                    </Link>
                    {/* Fuera del Link: un botón dentro de un anchor es HTML inválido y
                        además el clic navegaría en vez de silenciar. */}
                    {!dormido && (
                      <button
                        type="button"
                        onClick={() => silenciar(a)}
                        aria-label={`Marcar leído: ${a.titulo}`}
                        title="Marcar leído"
                        className="mr-2 mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-cloud hover:text-navy-950"
                      >
                        ✓
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-slate-100 bg-cloud/40 px-4 py-2">
            {silenciados.length > 0 ? (
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setVerSilenciados((v) => !v)}
                  className="text-[11px] font-bold text-electric-600 hover:underline"
                >
                  {verSilenciados
                    ? "Ocultar leídos"
                    : `Ver ${silenciados.length} leído${silenciados.length === 1 ? "" : "s"}`}
                </button>
                <button
                  type="button"
                  onClick={reactivar}
                  className="text-[11px] font-bold text-slate-400 hover:text-navy-950 hover:underline"
                >
                  Reactivar todos
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                Marcar leído silencia el aviso hasta que el número aumente.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
