"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { formatCLP } from "@/lib/format";
import {
  montoDesdePorcentaje,
  normalizarDescuento,
  porcentajeDesdeMonto,
  tramoLibre,
  type TopeLibre,
} from "@/lib/descuento";
import {
  autorizarDescuento,
  consultarAprobacion,
  solicitarAprobacionCorreo,
  type AutorizacionState,
  type SolicitudCorreoState,
} from "../actions";

export interface DescuentoAplicado {
  monto: number;
  motivo: string;
  /** Vale firmado por el servidor. Vacío cuando el monto cupo en el tramo libre. */
  vale: string;
  /** Nombre de quien autorizó. Vacío cuando lo aplicó el propio cajero. */
  autorizadoPor: string;
}

/** Contexto que viaja con la solicitud por correo, para que gerencia sepa qué aprueba. */
export interface ContextoCorreo {
  contexto: "POS" | "FACTURA";
  localId: string | null;
  clienteId: string | null;
}

interface Props {
  /** Monto sobre el que se calcula: total del carro en el POS, neto en la factura. */
  base: number;
  /** Si el usuario ya tiene el permiso, no se le piden credenciales de supervisor. */
  puedeDescontar: boolean;
  /**
   * Tramo que su perfil descuenta por su cuenta. Bajo ese techo tampoco se piden
   * credenciales; el servidor lo vuelve a medir contra el total real al cobrar.
   */
  tope?: TopeLibre | null;
  /**
   * Descuento pactado del cliente (en pesos sobre `base`), cuando la venta tiene un
   * cliente con ficha. Es un piso ya autorizado: el tramo libre corre encima de él.
   */
  descuentoCliente?: number;
  /** Habilita "pedir por correo a gerencia" cuando el monto exige supervisor. */
  correo?: ContextoCorreo;
  descuento: DescuentoAplicado | null;
  onCambio: (descuento: DescuentoAplicado | null) => void;
  /** "neto" en facturas, para dejar claro que el IVA se calcula después de la rebaja. */
  etiquetaBase?: string;
}

const vacio: AutorizacionState = {};
const vacioCorreo: SolicitudCorreoState = {};

/** Cada cuánto pregunta el POS si gerencia ya resolvió. */
const POLL_MS = 4000;

/**
 * Botón de descuento sobre el total, con su modal de autorización.
 *
 * Monto y porcentaje son dos vistas del mismo número: se escribe cualquiera de los dos y
 * el otro se recalcula. Lo que se guarda y viaja al servidor es siempre el monto en pesos,
 * porque un porcentaje guardado obliga a recalcular —y a arrastrar el redondeo— cada vez
 * que alguien abre la boleta seis meses después.
 *
 * Cuando el monto exige supervisor hay dos caminos hacia el mismo vale firmado: el
 * presencial (credenciales en el mesón, como siempre) y el remoto (correo a gerencia con
 * botones de un clic; el modal queda esperando y consulta hasta que alguien resuelva).
 *
 * El modal sale por un portal a `document.body`. No es cosmético: el botón vive dentro
 * del formulario de cobro (y del de factura), y el modal trae su propio formulario.
 * Anidar formularios no es HTML válido —el navegador descarta el interno— y el botón de
 * autorizar terminaría emitiendo la venta en vez de pedir la clave del supervisor.
 */
export function DescuentoBoton({
  base,
  puedeDescontar,
  tope,
  descuentoCliente = 0,
  correo,
  descuento,
  onCambio,
  etiquetaBase = "total",
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [motivo, setMotivo] = useState("");
  /** Solicitud enviada a gerencia, mientras el modal espera la resolución. */
  const [espera, setEspera] = useState<{ id: string; enviados: number; expiraEn: number } | null>(null);
  const [avisoEspera, setAvisoEspera] = useState<string | null>(null);
  const idMonto = useId();
  const idPct = useId();

  /** Piso pactado del cliente, recortado a la base para no prometer de más. */
  const piso = Math.min(Math.max(0, Math.round(descuentoCliente)), Math.max(0, Math.round(base)));

  /**
   * El resultado se procesa acá dentro y no en un efecto: el descuento aparece porque el
   * cajero envió el formulario, no porque un estado haya cambiado solo. Un efecto además
   * volvería a dispararse en cada render que traiga el mismo vale.
   */
  const [estado, accion, pendiente] = useActionState(
    async (previo: AutorizacionState, fd: FormData) => {
      // Bajo el piso del cliente más el tramo libre no hay a quién pedirle permiso, así
      // que no se molesta al servidor: se aplica de inmediato y queda a nombre del cajero.
      // El monto se relee del formulario en vez de confiar en el estado del render.
      const pedido = normalizarDescuento(base, Number(fd.get("monto") ?? 0));
      if (pedido > 0 && !puedeDescontar && pedido <= piso + tramoLibre(base, tope)) {
        onCambio({ monto: pedido, motivo: motivo.trim(), vale: "", autorizadoPor: "" });
        setAbierto(false);
        return {};
      }

      const res = await autorizarDescuento(previo, fd);
      if (res.vale && res.monto !== undefined) {
        onCambio({
          monto: res.monto,
          motivo: motivo.trim(),
          vale: res.vale,
          autorizadoPor: res.autorizadoPor ?? "",
        });
        setAbierto(false);
      }
      return res;
    },
    vacio,
  );

  /** Camino remoto: crea la solicitud, manda el correo y deja el modal esperando. */
  const [estadoCorreo, accionCorreo, pendienteCorreo] = useActionState(
    async (previo: SolicitudCorreoState, fd: FormData) => {
      const res = await solicitarAprobacionCorreo(previo, fd);
      if (res.solicitudId && res.expiraEn) {
        setEspera({ id: res.solicitudId, enviados: res.enviados ?? 0, expiraEn: res.expiraEn });
        setAvisoEspera(null);
      }
      return res;
    },
    vacioCorreo,
  );

  // Mientras hay solicitud pendiente, se consulta cada pocos segundos. El vale llega por
  // acá: cuando gerencia aprueba, se aplica igual que si un supervisor hubiera tecleado
  // su clave en el mesón.
  useEffect(() => {
    if (!espera) return;
    let vivo = true;
    const tick = async () => {
      const res = await consultarAprobacion(espera.id);
      if (!vivo) return;
      if (res.estado === "APROBADA") {
        onCambio({
          monto: res.monto,
          motivo: motivo.trim(),
          vale: res.vale,
          autorizadoPor: res.autorizadoPor,
        });
        setEspera(null);
        setAbierto(false);
      } else if (res.estado === "RECHAZADA") {
        setEspera(null);
        setAvisoEspera(`${res.por} rechazó el descuento.`);
      } else if (res.estado === "EXPIRADA") {
        setEspera(null);
        setAvisoEspera("Nadie respondió a tiempo: la solicitud expiró. Puedes enviarla de nuevo.");
      } else if (res.estado === "ERROR") {
        setEspera(null);
        setAvisoEspera(res.error);
      }
    };
    const intervalo = setInterval(tick, POLL_MS);
    return () => {
      vivo = false;
      clearInterval(intervalo);
    };
  }, [espera, motivo, onCambio]);

  function escribirMonto(valor: string) {
    setMonto(valor);
    const n = normalizarDescuento(base, Number(valor));
    setPorcentaje(n > 0 ? String(porcentajeDesdeMonto(base, n)) : "");
  }

  function escribirPorcentaje(valor: string) {
    setPorcentaje(valor);
    const n = montoDesdePorcentaje(base, Number(valor));
    setMonto(n > 0 ? String(n) : "");
  }

  function abrir() {
    const actual = descuento?.monto ?? 0;
    setMonto(actual > 0 ? String(actual) : "");
    setPorcentaje(actual > 0 ? String(porcentajeDesdeMonto(base, actual)) : "");
    setMotivo(descuento?.motivo ?? "");
    setAvisoEspera(null);
    setAbierto(true);
  }

  const previsualizado = normalizarDescuento(base, Number(monto));
  /**
   * Techo propio del cajero: el pactado del cliente más su tramo libre. Quien ya tiene
   * el permiso no tiene techo que consultar. Es la copia de cortesía para decidir si se
   * muestran los campos del supervisor; la que manda es la del servidor.
   */
  const libre = puedeDescontar ? Number.POSITIVE_INFINITY : piso + tramoLibre(base, tope);
  const requiereSupervisor = previsualizado > libre;

  if (descuento) {
    return (
      <div className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#b45309]">
            Descuento {formatCLP(descuento.monto)}
            <span className="font-semibold"> · {porcentajeDesdeMonto(base, descuento.monto)}%</span>
          </p>
          <p className="truncate text-[11px] text-slate-500">
            {descuento.autorizadoPor ? `Autorizó ${descuento.autorizadoPor}` : "Dentro de tu tramo"}
            {descuento.motivo ? ` · ${descuento.motivo}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onCambio(null)}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-fenix-600"
        >
          Quitar
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        disabled={base <= 0}
        className="mb-3 w-full rounded-xl border border-dashed border-slate-300 py-2 text-sm font-bold text-slate-500 transition hover:border-[#f59e0b] hover:text-[#b45309] disabled:opacity-40"
      >
        Aplicar descuento
      </button>

      {/* Sin guarda de montaje: `abierto` solo se enciende con un clic, así que el portal
          nunca se evalúa durante el render del servidor, donde no existe `document`. */}
      {abierto &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            {espera ? (
              /* Esperando a gerencia: el formulario se guarda hasta que alguien resuelva */
              <div className="text-center">
                <p className="text-3xl">📨</p>
                <h2 className="mt-2 text-lg font-black text-navy-950">
                  Esperando a gerencia
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Correo enviado{espera.enviados > 1 ? ` a ${espera.enviados} personas` : ""}. En
                  cuanto alguien apruebe, el descuento se aplica solo.
                </p>
                <p className="mt-3 rounded-xl bg-cloud/60 px-3 py-2 text-sm text-slate-600">
                  Descuento pedido:{" "}
                  <b className="tabular-nums text-navy-950">{formatCLP(previsualizado)}</b>
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  La solicitud vence sola si nadie responde. Puedes cancelar y autorizar
                  presencialmente cuando quieras.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEspera(null);
                    setAvisoEspera(null);
                  }}
                  className="mt-4 h-11 w-full rounded-xl border border-slate-300 font-bold text-slate-600 transition hover:bg-cloud/60"
                >
                  Cancelar la espera
                </button>
              </div>
            ) : (
            <>
            <h2 className="text-lg font-black text-navy-950">Descuento sobre el {etiquetaBase}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {etiquetaBase === "neto"
                ? `Neto actual ${formatCLP(base)}. El IVA se calcula sobre el neto ya rebajado.`
                : `Total actual ${formatCLP(base)}.`}
            </p>

            <form action={accion} className="mt-4 space-y-3">
              <input type="hidden" name="base" value={base} />
              {correo && (
                <>
                  <input type="hidden" name="contexto" value={correo.contexto} />
                  <input type="hidden" name="localId" value={correo.localId ?? ""} />
                  <input type="hidden" name="clienteId" value={correo.clienteId ?? ""} />
                </>
              )}

              <div className="flex gap-2">
                <div className="flex-1">
                  <label htmlFor={idMonto} className="mb-1 block text-xs font-semibold text-slate-700">
                    Monto
                  </label>
                  <input
                    id={idMonto}
                    name="monto"
                    type="number"
                    min={0}
                    max={base}
                    inputMode="numeric"
                    autoFocus
                    value={monto}
                    onChange={(e) => escribirMonto(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-300 px-3 tabular-nums outline-none focus:border-electric-500"
                  />
                </div>
                <div className="w-24">
                  <label htmlFor={idPct} className="mb-1 block text-xs font-semibold text-slate-700">
                    %
                  </label>
                  <input
                    id={idPct}
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    inputMode="decimal"
                    value={porcentaje}
                    onChange={(e) => escribirPorcentaje(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-300 px-3 tabular-nums outline-none focus:border-electric-500"
                  />
                </div>
              </div>

              {previsualizado > 0 && (
                <p className="rounded-xl bg-cloud/60 px-3 py-2 text-sm text-slate-600">
                  Queda en{" "}
                  <b className="tabular-nums text-navy-950">{formatCLP(base - previsualizado)}</b>
                </p>
              )}

              {/* Se dice el techo antes de que se pase, no después de rebotarlo. */}
              {!puedeDescontar && libre > 0 && !requiereSupervisor && (
                <p className="text-xs text-slate-500">
                  Puedes descontar hasta <b className="tabular-nums">{formatCLP(libre)}</b> sin
                  autorización
                  {piso > 0 ? (
                    <> (el cliente ya tiene {formatCLP(piso)} pactados)</>
                  ) : null}
                  .
                </p>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Motivo <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <input
                  type="text"
                  name="motivo"
                  maxLength={120}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Cliente frecuente, producto con detalle…"
                  className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-electric-500"
                />
              </div>

              {requiereSupervisor && (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-cloud/40 p-3">
                  <p className="text-xs font-bold text-slate-600">
                    Requiere autorización de un supervisor
                  </p>
                  <input
                    name="email"
                    type="email"
                    autoComplete="off"
                    placeholder="Correo"
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-electric-500"
                  />
                  <input
                    name="clave"
                    type="password"
                    autoComplete="off"
                    placeholder="Contraseña"
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-electric-500"
                  />
                  {correo && (
                    <>
                      <p className="pt-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        o si no hay nadie en el local
                      </p>
                      {/* formAction: mismo formulario, otra Server Action. Toma el monto y
                          el motivo ya escritos y no exige las credenciales de arriba. */}
                      <button
                        type="submit"
                        formAction={accionCorreo}
                        formNoValidate
                        disabled={pendienteCorreo || previsualizado <= 0}
                        className="h-10 w-full rounded-lg border border-electric-500/50 bg-white text-sm font-bold text-electric-600 transition hover:bg-electric-50 disabled:opacity-40"
                      >
                        {pendienteCorreo ? "Enviando correo…" : "📨 Pedir aprobación por correo a gerencia"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {(estado.error || estadoCorreo.error || avisoEspera) && (
                <p role="alert" className="text-sm font-semibold text-fenix-600">
                  {estado.error ?? estadoCorreo.error ?? avisoEspera}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="h-11 flex-1 rounded-xl border border-slate-300 font-bold text-slate-600 transition hover:bg-cloud/60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pendiente || previsualizado <= 0}
                  className="bg-flame h-11 flex-1 rounded-xl font-black text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  {pendiente ? "Validando…" : "Aplicar"}
                </button>
              </div>
            </form>
            </>
            )}
          </div>
          </div>,
          document.body,
        )}
    </>
  );
}
