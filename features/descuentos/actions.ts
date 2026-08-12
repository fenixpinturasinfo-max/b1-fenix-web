"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { puedeEscribir } from "@/lib/auth/permissions";
import {
  firmarVale,
  normalizarDescuento,
  porcentajeDesdeMonto,
  SECCION_DESCUENTO,
} from "@/lib/descuento";
import { enviarCorreo } from "@/lib/email";
import { formatCLP } from "@/lib/format";
import {
  firmarAprobacion,
  verificarAprobacion,
  urlBase,
  SOLICITUD_MINUTOS,
  type AccionAprobacion,
} from "./aprobaciones";

export interface AutorizacionState {
  error?: string;
  /** Vale firmado que el formulario reenvía junto con la venta o la factura. */
  vale?: string;
  /** Nombre de quien autorizó, para mostrarlo en pantalla. */
  autorizadoPor?: string;
  /** Monto efectivamente autorizado, ya normalizado por el servidor. */
  monto?: number;
}

/**
 * Autoriza un descuento en el mesón.
 *
 * Dos caminos, misma salida:
 *  · quien opera ya tiene el permiso → se autoriza a sí mismo, sin pedir credenciales;
 *  · no lo tiene → un gerente teclea correo y clave acá mismo y el vale sale a su nombre.
 *
 * El monto se recorta contra la base que manda el cliente, pero eso es solo comodidad:
 * la base real la recalcula la Server Action que registra la venta o emite la factura,
 * y ahí se vuelve a validar. Nunca se confía en el total que llega del navegador.
 */
export async function autorizarDescuento(
  _prev: AutorizacionState,
  formData: FormData,
): Promise<AutorizacionState> {
  try {
    const sesion = await getSession();
    if (!sesion) return { error: "Tu sesión expiró. Vuelve a entrar." };

    const base = Number(formData.get("base") ?? 0);
    const montoPedido = Number(formData.get("monto") ?? 0);
    const monto = normalizarDescuento(base, montoPedido);

    if (monto <= 0) return { error: "Ingresa un descuento mayor a cero." };

    // Camino corto: el propio usuario tiene la llave.
    if (await puedeEscribir(sesion.rol, SECCION_DESCUENTO)) {
      return {
        vale: await firmarVale({
          autorizadorId: sesion.sub,
          autorizadorNombre: sesion.nombre,
          monto,
        }),
        autorizadoPor: sesion.nombre,
        monto,
      };
    }

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const clave = String(formData.get("clave") ?? "");
    if (!email || !clave) {
      return { error: "Se necesita la autorización de un supervisor." };
    }

    const autorizador = await prisma.usuario.findUnique({ where: { email } });
    // Se compara igual aunque el usuario no exista para no revelar qué correos son válidos,
    // y para que el tiempo de respuesta no delate la diferencia.
    const hash = autorizador?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
    const claveOk = await bcrypt.compare(clave, hash);

    if (!autorizador || !autorizador.activo || !claveOk) {
      return { error: "Credenciales incorrectas." };
    }
    if (!(await puedeEscribir(autorizador.rol, SECCION_DESCUENTO))) {
      return { error: `${autorizador.nombre} no tiene permiso para autorizar descuentos.` };
    }

    return {
      vale: await firmarVale({
        autorizadorId: autorizador.id,
        autorizadorNombre: autorizador.nombre,
        monto,
      }),
      autorizadoPor: autorizador.nombre,
      monto,
    };
  } catch {
    return { error: "No se pudo validar la autorización." };
  }
}

// ───────────────────── Aprobación por correo a gerencia ─────────────────────

export interface SolicitudCorreoState {
  error?: string;
  solicitudId?: string;
  /** A cuántos buzones salió el correo, para decirlo en pantalla. */
  enviados?: number;
  /** Epoch ms en que la solicitud deja de valer, para la cuenta regresiva. */
  expiraEn?: number;
}

/**
 * Crea la solicitud y envía el correo a cada persona que puede autorizar descuentos.
 *
 * Es el camino remoto: el gerente no está en el local, así que en vez de teclear sus
 * credenciales en la caja recibe un correo con botones de un clic. Cada destinatario
 * recibe **su propio** enlace firmado, para que la aprobación quede a nombre de quien
 * la hizo y no de "el que abrió el correo primero" (que es la misma persona, pero
 * demostrable). El POS queda consultando `consultarAprobacion` hasta que alguien
 * resuelva o el tiempo se acabe.
 */
export async function solicitarAprobacionCorreo(
  _prev: SolicitudCorreoState,
  formData: FormData,
): Promise<SolicitudCorreoState> {
  try {
    const sesion = await getSession();
    if (!sesion) return { error: "Tu sesión expiró. Vuelve a entrar." };

    const base = Number(formData.get("base") ?? 0);
    const monto = normalizarDescuento(base, Number(formData.get("monto") ?? 0));
    if (monto <= 0) return { error: "Ingresa un descuento mayor a cero." };

    const contexto = String(formData.get("contexto") ?? "POS") === "FACTURA" ? "FACTURA" : "POS";
    const motivo = String(formData.get("motivo") ?? "").trim().slice(0, 120) || null;
    const localId = String(formData.get("localId") ?? "") || sesion.localId;
    if (!localId) return { error: "No se pudo determinar el local de la venta." };

    const enlaces = urlBase();
    if (!enlaces) {
      return {
        error:
          "Falta configurar APP_URL: sin la dirección pública no se pueden armar los enlaces del correo.",
      };
    }

    // Cliente con ficha, si venía. Se guarda como contexto para quien aprueba; si el id
    // no existe se sigue sin él en vez de frenar la venta por un dato accesorio.
    const clienteIdRaw = String(formData.get("clienteId") ?? "") || null;
    const cliente = clienteIdRaw
      ? await prisma.socioNegocio.findFirst({
          where: { id: clienteIdRaw, tipo: "CLIENTE" },
          select: { id: true, razonSocial: true, nombreFantasia: true, descuentoPorcentaje: true },
        })
      : null;

    const local = await prisma.local.findUnique({
      where: { id: localId },
      select: { id: true, nombre: true },
    });
    if (!local) return { error: "Local inválido." };

    // Quiénes pueden autorizar: los perfiles con nivel Total en `ventas.descuento`
    // (configurable en Perfiles) más el administrador, que siempre puede todo.
    const filas = await prisma.permisoPerfil.findMany({
      where: { seccion: SECCION_DESCUENTO, nivel: "TOTAL" },
      select: { rol: true },
    });
    const roles = [...new Set(["ADMINISTRADOR", ...filas.map((f) => String(f.rol))])];
    const aprobadores = await prisma.usuario.findMany({
      // Sin el solicitante: si pudiera autorizar, no habría llegado a este camino.
      where: { activo: true, rol: { in: roles as never }, id: { not: sesion.sub } },
      select: { id: true, nombre: true, email: true },
    });
    if (aprobadores.length === 0) {
      return { error: "No hay nadie con permiso para autorizar descuentos." };
    }

    const solicitud = await prisma.solicitudDescuento.create({
      data: {
        contexto,
        localId: local.id,
        solicitanteId: sesion.sub,
        clienteId: cliente?.id ?? null,
        base: Math.round(base),
        monto,
        motivo,
        expiraEn: new Date(Date.now() + SOLICITUD_MINUTOS * 60_000),
      },
      select: { id: true, expiraEn: true },
    });

    // Un correo por persona, cada uno con sus enlaces. En serie a propósito: son dos o
    // tres gerentes, y abrir conexiones SMTP en paralelo no vale la complejidad.
    let enviados = 0;
    let ultimoError = "";
    for (const a of aprobadores) {
      const [aprobar, rechazar] = await Promise.all([
        firmarAprobacion({ solicitudId: solicitud.id, aprobadorId: a.id, accion: "APROBAR" }),
        firmarAprobacion({ solicitudId: solicitud.id, aprobadorId: a.id, accion: "RECHAZAR" }),
      ]);
      const resultado = await enviarCorreo({
        para: a.email,
        asunto: `Autorización de descuento · ${formatCLP(monto)} en ${local.nombre}`,
        html: correoAprobacion({
          aprobador: a.nombre,
          solicitante: sesion.nombre,
          local: local.nombre,
          contexto,
          cliente: cliente ? (cliente.nombreFantasia ?? cliente.razonSocial) : null,
          clientePorcentaje: cliente?.descuentoPorcentaje ?? 0,
          base,
          monto,
          motivo,
          urlAprobar: `${enlaces}/aprobar-descuento/${encodeURIComponent(aprobar)}`,
          urlRechazar: `${enlaces}/aprobar-descuento/${encodeURIComponent(rechazar)}`,
        }),
      });
      if (resultado.ok) enviados++;
      else ultimoError = resultado.error;
    }

    if (enviados === 0) {
      return { error: ultimoError || "No se pudo enviar el correo a gerencia." };
    }

    return { solicitudId: solicitud.id, enviados, expiraEn: solicitud.expiraEn.getTime() };
  } catch {
    return { error: "No se pudo crear la solicitud de aprobación." };
  }
}

export type EstadoConsulta =
  | { estado: "PENDIENTE" }
  | { estado: "EXPIRADA" }
  | { estado: "RECHAZADA"; por: string }
  | { estado: "APROBADA"; vale: string; autorizadoPor: string; monto: number }
  | { estado: "ERROR"; error: string };

/**
 * Estado de una solicitud, consultado por el POS cada pocos segundos mientras espera.
 *
 * Recién cuando está APROBADA se emite el vale firmado —el mismo de la autorización
 * presencial— y de ahí en adelante el cobro sigue el camino de siempre: la Server Action
 * que registra la venta lo vuelve a verificar contra el monto. Solo el solicitante puede
 * consultar: la solicitud es suya y el vale sale a nombre de quien la aprobó.
 */
export async function consultarAprobacion(solicitudId: string): Promise<EstadoConsulta> {
  try {
    const sesion = await getSession();
    if (!sesion) return { estado: "ERROR", error: "Tu sesión expiró. Vuelve a entrar." };

    const s = await prisma.solicitudDescuento.findUnique({
      where: { id: solicitudId },
      select: {
        estado: true,
        monto: true,
        expiraEn: true,
        solicitanteId: true,
        resueltaPor: { select: { id: true, nombre: true } },
      },
    });
    if (!s || s.solicitanteId !== sesion.sub) {
      return { estado: "ERROR", error: "Solicitud no encontrada." };
    }

    if (s.estado === "APROBADA" && s.resueltaPor) {
      return {
        estado: "APROBADA",
        monto: s.monto,
        autorizadoPor: s.resueltaPor.nombre,
        vale: await firmarVale({
          autorizadorId: s.resueltaPor.id,
          autorizadorNombre: s.resueltaPor.nombre,
          monto: s.monto,
        }),
      };
    }
    if (s.estado === "RECHAZADA") {
      return { estado: "RECHAZADA", por: s.resueltaPor?.nombre ?? "gerencia" };
    }
    if (s.expiraEn.getTime() < Date.now()) return { estado: "EXPIRADA" };
    return { estado: "PENDIENTE" };
  } catch {
    return { estado: "ERROR", error: "No se pudo consultar la solicitud." };
  }
}

export interface ResultadoResolucion {
  ok: boolean;
  titulo: string;
  detalle: string;
  /** Para pintar la tarjeta con lo que se resolvió. */
  info?: {
    accion: AccionAprobacion;
    monto: number;
    base: number;
    solicitante: string;
    local: string;
    cliente: string | null;
    motivo: string | null;
  };
}

/**
 * Resuelve una solicitud desde el enlace del correo. Sin sesión: el token firmado es la
 * credencial, y trae adentro quién resuelve y en qué sentido.
 *
 * El permiso del aprobador se verifica **al momento del clic**, no al enviar el correo:
 * entre uno y otro pudieron desactivarlo o quitarle la llave. Y la actualización es un
 * UPDATE condicionado al estado PENDIENTE: si dos gerentes tocan sus enlaces a la vez,
 * gana uno solo y el otro ve quién se le adelantó.
 */
export async function resolverSolicitudCorreo(token: string): Promise<ResultadoResolucion> {
  try {
    const datos = await verificarAprobacion(token);
    if (!datos) {
      return {
        ok: false,
        titulo: "Enlace inválido o vencido",
        detalle: "Pide al vendedor que envíe la solicitud de nuevo.",
      };
    }

    const s = await prisma.solicitudDescuento.findUnique({
      where: { id: datos.solicitudId },
      include: {
        solicitante: { select: { nombre: true } },
        local: { select: { nombre: true } },
        cliente: { select: { razonSocial: true, nombreFantasia: true } },
        resueltaPor: { select: { nombre: true } },
      },
    });
    if (!s) {
      return { ok: false, titulo: "Solicitud no encontrada", detalle: "Puede que se haya depurado." };
    }

    const info = {
      accion: datos.accion,
      monto: s.monto,
      base: s.base,
      solicitante: s.solicitante.nombre,
      local: s.local.nombre,
      cliente: s.cliente ? (s.cliente.nombreFantasia ?? s.cliente.razonSocial) : null,
      motivo: s.motivo,
    };

    if (s.estado !== "PENDIENTE") {
      const que = s.estado === "APROBADA" ? "aprobada" : "rechazada";
      return {
        ok: false,
        titulo: `Esta solicitud ya fue ${que}`,
        detalle: `La resolvió ${s.resueltaPor?.nombre ?? "otra persona"}. No hay nada más que hacer.`,
        info,
      };
    }
    if (s.expiraEn.getTime() < Date.now()) {
      return {
        ok: false,
        titulo: "La solicitud expiró",
        detalle: `Valía ${SOLICITUD_MINUTOS} minutos. Si la venta sigue en el mesón, pide que la envíen de nuevo.`,
        info,
      };
    }

    // El permiso se revalida ahora: el correo pudo quedar en un buzón que ya no autoriza.
    const aprobador = await prisma.usuario.findUnique({ where: { id: datos.aprobadorId } });
    if (!aprobador || !aprobador.activo || !(await puedeEscribir(aprobador.rol, SECCION_DESCUENTO))) {
      return {
        ok: false,
        titulo: "Sin permiso para resolver",
        detalle: "Tu cuenta ya no puede autorizar descuentos.",
      };
    }

    const actualizada = await prisma.solicitudDescuento.updateMany({
      where: { id: s.id, estado: "PENDIENTE" },
      data: {
        estado: datos.accion === "APROBAR" ? "APROBADA" : "RECHAZADA",
        resueltaPorId: aprobador.id,
        resueltaEn: new Date(),
      },
    });
    if (actualizada.count !== 1) {
      return {
        ok: false,
        titulo: "Alguien se adelantó",
        detalle: "Otra persona resolvió esta solicitud hace un momento.",
        info,
      };
    }

    return datos.accion === "APROBAR"
      ? {
          ok: true,
          titulo: "Descuento aprobado",
          detalle: `${s.solicitante.nombre} ya puede cerrar la venta con ${formatCLP(s.monto)} de descuento.`,
          info,
        }
      : {
          ok: true,
          titulo: "Descuento rechazado",
          detalle: `${s.solicitante.nombre} verá el rechazo en la caja.`,
          info,
        };
  } catch {
    return {
      ok: false,
      titulo: "No se pudo resolver la solicitud",
      detalle: "Inténtalo de nuevo, o resuélvelo presencialmente en la caja.",
    };
  }
}

/** El motivo lo teclea el cajero: si trae `<` o `&`, que se lea, no que se ejecute. */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HTML del correo a gerencia. Mismo estilo sobrio de la boleta por correo. */
function correoAprobacion(d: {
  aprobador: string;
  solicitante: string;
  local: string;
  contexto: string;
  cliente: string | null;
  clientePorcentaje: number;
  base: number;
  monto: number;
  motivo: string | null;
  urlAprobar: string;
  urlRechazar: string;
}): string {
  const pct = porcentajeDesdeMonto(d.base, d.monto);
  const fila = (k: string, v: string) => `
    <tr>
      <td style="padding:6px 0;color:#888;font-size:13px;">${k}</td>
      <td style="padding:6px 0;text-align:right;font-size:13px;"><b>${v}</b></td>
    </tr>`;

  return `
    <div style="font-family:Arial,sans-serif;max-width:440px;margin:0 auto;color:#101828;">
      <div style="text-align:center;padding:16px 0;">
        <h2 style="margin:0;">PINTURAS FENIX</h2>
        <p style="margin:4px 0;color:#555;font-size:13px;">Autorización de descuento</p>
      </div>
      <p style="font-size:14px;">Hola ${escaparHtml(d.aprobador)}:</p>
      <p style="font-size:14px;">
        <b>${escaparHtml(d.solicitante)}</b> (${escaparHtml(d.local)}) pide autorizar un descuento en
        ${d.contexto === "FACTURA" ? "una factura de venta" : "una venta del POS"}.
      </p>
      <table style="width:100%;border-collapse:collapse;border-top:1px dashed #ccc;border-bottom:1px dashed #ccc;margin:12px 0;">
        ${d.cliente ? fila("Cliente", `${escaparHtml(d.cliente)}${d.clientePorcentaje > 0 ? ` (pactado ${d.clientePorcentaje}%)` : ""}`) : ""}
        ${fila(d.contexto === "FACTURA" ? "Neto actual" : "Total actual", formatCLP(d.base))}
        ${fila("Descuento pedido", `${formatCLP(d.monto)} · ${pct}%`)}
        ${fila("Quedaría en", formatCLP(Math.max(0, Math.round(d.base) - d.monto)))}
        ${d.motivo ? fila("Motivo", escaparHtml(d.motivo)) : ""}
      </table>
      <p style="font-size:13px;color:#555;">
        Vale por ${SOLICITUD_MINUTOS} minutos. Con un toque queda resuelto; no necesitas iniciar sesión.
      </p>
      <div style="text-align:center;margin:20px 0;">
        <a href="${d.urlAprobar}"
           style="display:inline-block;background:#4d7c0f;color:#fff;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:10px;text-decoration:none;margin:4px;">
          ✓ Aprobar descuento
        </a>
        <a href="${d.urlRechazar}"
           style="display:inline-block;background:#b42318;color:#fff;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:10px;text-decoration:none;margin:4px;">
          ✕ Rechazar
        </a>
      </div>
      <p style="text-align:center;color:#aaa;font-size:12px;margin-top:24px;">
        Si no esperabas este correo, ignóralo: la solicitud expira sola.
      </p>
    </div>`;
}
