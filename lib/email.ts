/**
 * Cliente SMTP mínimo, sin dependencias externas.
 *
 * Habla SMTP directo sobre `node:net` + `node:tls`: STARTTLS en el puerto 587 (Gmail)
 * o TLS implícito en el 465. Se prefirió esto antes que nodemailer para no sumar un
 * paquete más al bundle serverless; a cambio, acá vive el protocolo completo.
 *
 * IMPORTANTE: solo puede ejecutarse en el runtime Node de Vercel (Server Actions y
 * Route Handlers lo usan por defecto). En el runtime Edge no existen los sockets TCP.
 *
 * Variables de entorno:
 *   EMAIL_USER       cuenta que autentica y firma como remitente (obligatoria)
 *   EMAIL_PASS       contraseña de aplicación de Google, con o sin espacios (obligatoria)
 *   EMAIL_HOST       por defecto smtp.gmail.com
 *   EMAIL_PORT       587 (STARTTLS) o 465 (TLS implícito). Por defecto 587
 *   EMAIL_SECURE     fuerza TLS implícito ("true") o STARTTLS ("false"). Por defecto,
 *                    se deduce del puerto: 465 → implícito, cualquier otro → STARTTLS
 *   EMAIL_FROM_NAME  nombre visible del remitente. Por defecto "Pinturas Fenix"
 */
import net from "node:net";
import tls from "node:tls";
import { randomUUID } from "node:crypto";

/** Ni la conexión ni ninguna respuesta del servidor pueden demorar más que esto. */
const TIEMPO_LIMITE_MS = 20_000;

export interface CorreoSalida {
  /** Uno o varios destinatarios. */
  para: string | string[];
  asunto: string;
  html: string;
  /** Dirección a la que responde el cliente si no es la cuenta remitente. */
  responderA?: string;
}

export type ResultadoEnvio = { ok: true } | { ok: false; error: string };

// ─────────────── Configuración ───────────────

interface ConfigSmtp {
  usuario: string;
  clave: string;
  host: string;
  puerto: number;
  /** true = TLS desde el primer byte (465); false = conexión plana + STARTTLS (587). */
  tlsImplicito: boolean;
  nombre: string;
  dominio: string;
}

/** Extrae "Pinturas Fenix" de un valor tipo `Pinturas Fenix <hola@dominio.cl>`. */
function nombreDesdeFrom(valor: string | undefined): string | null {
  const nombre = valor?.replace(/<[^>]*>/g, "").replace(/"/g, "").trim();
  return nombre ? nombre : null;
}

function leerConfig(): ConfigSmtp | { error: string } {
  const usuario = process.env.EMAIL_USER?.trim();
  // Google muestra la contraseña de aplicación en grupos de 4 separados por espacios;
  // esos espacios son decorativos y el servidor los rechaza si viajan en el AUTH.
  const clave = process.env.EMAIL_PASS?.replace(/\s+/g, "");

  if (!usuario || !clave) {
    return { error: "Envío por correo no configurado (faltan EMAIL_USER / EMAIL_PASS)." };
  }

  const puerto = Number(process.env.EMAIL_PORT) || 587;
  const secure = process.env.EMAIL_SECURE?.trim().toLowerCase();

  return {
    usuario,
    clave,
    host: process.env.EMAIL_HOST?.trim() || "smtp.gmail.com",
    puerto,
    tlsImplicito: secure === "true" || secure === "1" ? true : secure ? false : puerto === 465,
    nombre:
      process.env.EMAIL_FROM_NAME?.trim() ||
      nombreDesdeFrom(process.env.EMAIL_FROM) ||
      "Pinturas Fenix",
    dominio: usuario.split("@")[1] ?? "localhost",
  };
}

// ─────────────── Sesión SMTP ───────────────

interface Respuesta {
  codigo: number;
  texto: string;
}

/**
 * Envoltura sobre el socket que convierte el diálogo SMTP en promesas.
 *
 * El servidor responde en bloques multilínea (`250-...` seguidos de `250 ...`), y a veces
 * varias respuestas llegan en un mismo paquete TCP: por eso el buffer se procesa línea a
 * línea y las respuestas completas se encolan hasta que alguien las pida con `esperar()`.
 */
class SesionSmtp {
  private socket: net.Socket;
  private buffer = "";
  private lineas: string[] = [];
  private recibidas: Respuesta[] = [];
  private cola: Array<{ resolver: (r: Respuesta) => void; rechazar: (e: Error) => void }> = [];
  private fallo: Error | null = null;

  constructor(socket: net.Socket) {
    this.socket = socket;
    this.escuchar(socket);
  }

  private escuchar(socket: net.Socket) {
    socket.setEncoding("utf8");
    socket.setTimeout(TIEMPO_LIMITE_MS);
    socket.on("data", (trozo: string) => this.procesar(trozo));
    socket.on("timeout", () =>
      this.abortar(new Error("Tiempo de espera agotado con el servidor SMTP.")),
    );
    socket.on("error", (e: Error) => this.abortar(e));
    socket.on("close", () => this.abortar(new Error("El servidor SMTP cerró la conexión.")));
  }

  private procesar(trozo: string) {
    this.buffer += trozo;
    let corte = this.buffer.indexOf("\r\n");
    while (corte !== -1) {
      const linea = this.buffer.slice(0, corte);
      this.buffer = this.buffer.slice(corte + 2);
      this.lineas.push(linea);
      // Un código seguido de espacio (o solo, sin texto) cierra el bloque de respuesta.
      if (/^\d{3}(\s|$)/.test(linea)) {
        const bloque = this.lineas;
        this.lineas = [];
        this.entregar({
          codigo: Number(linea.slice(0, 3)),
          texto: bloque
            .map((l) => l.slice(4).trim())
            .filter(Boolean)
            .join(" "),
        });
      }
      corte = this.buffer.indexOf("\r\n");
    }
  }

  private entregar(respuesta: Respuesta) {
    const espera = this.cola.shift();
    if (espera) espera.resolver(respuesta);
    else this.recibidas.push(respuesta);
  }

  private abortar(error: Error) {
    if (this.fallo) return;
    this.fallo = error;
    for (const espera of this.cola.splice(0)) espera.rechazar(error);
  }

  esperar(): Promise<Respuesta> {
    const lista = this.recibidas.shift();
    if (lista) return Promise.resolve(lista);
    if (this.fallo) return Promise.reject(this.fallo);
    return new Promise((resolver, rechazar) => this.cola.push({ resolver, rechazar }));
  }

  escribir(texto: string) {
    this.socket.write(texto);
  }

  /** Envía un comando y valida que el código de respuesta sea uno de los esperados. */
  async ordenar(comando: string, ...esperados: number[]): Promise<Respuesta> {
    this.socket.write(comando + "\r\n");
    const respuesta = await this.esperar();
    if (!esperados.includes(respuesta.codigo)) {
      throw new Error(`SMTP ${respuesta.codigo}: ${respuesta.texto}`);
    }
    return respuesta;
  }

  /** Cambia el socket plano por uno cifrado tras un STARTTLS aceptado. */
  async iniciarTls(host: string): Promise<void> {
    const base = this.socket;
    // El socket TLS toma control del stream: nuestros listeners deben soltarlo antes.
    base.removeAllListeners("data");
    base.removeAllListeners("timeout");
    base.removeAllListeners("error");
    base.removeAllListeners("close");
    base.setTimeout(0);

    const seguro = tls.connect({ socket: base, servername: host });
    await new Promise<void>((resolver, rechazar) => {
      seguro.once("secureConnect", () => resolver());
      seguro.once("error", rechazar);
    });

    this.buffer = "";
    this.lineas = [];
    this.recibidas = [];
    this.socket = seguro;
    this.escuchar(seguro);
  }

  cerrar() {
    try {
      this.socket.write("QUIT\r\n");
    } catch {
      /* la conexión ya estaba caída */
    }
    this.socket.destroy();
  }
}

async function conectar(host: string, puerto: number, implicito: boolean): Promise<SesionSmtp> {
  const socket: net.Socket = implicito
    ? tls.connect({ host, port: puerto, servername: host })
    : net.connect({ host, port: puerto });

  await new Promise<void>((resolver, rechazar) => {
    const temporizador = setTimeout(
      () => rechazar(new Error(`No se pudo conectar a ${host}:${puerto}.`)),
      TIEMPO_LIMITE_MS,
    );
    socket.once(implicito ? "secureConnect" : "connect", () => {
      clearTimeout(temporizador);
      resolver();
    });
    socket.once("error", (e: Error) => {
      clearTimeout(temporizador);
      rechazar(e);
    });
  });

  return new SesionSmtp(socket);
}

// ─────────────── Armado del mensaje ───────────────

const SOLO_ASCII = /^[\x20-\x7E]*$/;

/** Codifica una cabecera con tildes o ñ según RFC 2047, en trozos que no pasen los 75 chars. */
function cabecera(valor: string): string {
  if (SOLO_ASCII.test(valor)) return valor;

  const trozos: string[] = [];
  let actual = "";
  for (const caracter of Array.from(valor)) {
    if (Buffer.byteLength(actual + caracter, "utf8") > 42) {
      trozos.push(actual);
      actual = "";
    }
    actual += caracter;
  }
  if (actual) trozos.push(actual);

  return trozos
    .map((t) => `=?UTF-8?B?${Buffer.from(t, "utf8").toString("base64")}?=`)
    .join("\r\n ");
}

/** Base64 en líneas de 76 caracteres, como exige MIME. */
function base64(texto: string): string {
  const datos = Buffer.from(texto, "utf8").toString("base64");
  return (datos.match(/.{1,76}/g) ?? []).join("\r\n");
}

/**
 * Versión en texto plano del HTML. No busca fidelidad: existe porque un correo que solo
 * trae `text/html` puntúa peor en los filtros de spam que uno multipart.
 */
function aTextoPlano(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|table|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function construirMensaje(config: ConfigSmtp, para: string[], correo: CorreoSalida): string {
  const limite = `=_fenix_${randomUUID()}`;
  const remitente = SOLO_ASCII.test(config.nombre)
    ? `"${config.nombre.replace(/"/g, "")}"`
    : cabecera(config.nombre);

  const cabeceras = [
    `From: ${remitente} <${config.usuario}>`,
    `To: ${para.join(", ")}`,
    correo.responderA ? `Reply-To: ${correo.responderA}` : null,
    `Subject: ${cabecera(correo.asunto)}`,
    // toUTCString() cierra con "GMT"; RFC 5322 pide el desplazamiento numérico.
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${randomUUID()}@${config.dominio}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${limite}"`,
  ].filter((linea): linea is string => linea !== null);

  // El cuerpo va en base64: ninguna línea puede empezar con "." , así que no hace falta
  // el "dot stuffing" que exige el protocolo para texto crudo.
  return [
    ...cabeceras,
    "",
    `--${limite}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64(aTextoPlano(correo.html)),
    `--${limite}`,
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64(correo.html),
    `--${limite}--`,
    "",
  ].join("\r\n");
}

// ─────────────── API pública ───────────────

/** Traduce los códigos SMTP más comunes a algo que el cajero pueda entender. */
function mensajeAmable(error: unknown): string {
  const detalle = error instanceof Error ? error.message : String(error);

  if (/SMTP 53[45]/.test(detalle) || /BadCredentials/i.test(detalle)) {
    return "Credenciales de correo rechazadas. Revisa EMAIL_USER y la contraseña de aplicación (EMAIL_PASS).";
  }
  if (/SMTP 55\d/.test(detalle)) {
    return "El servidor rechazó el destinatario o el remitente. Verifica la dirección de correo.";
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|No se pudo conectar|Tiempo de espera/i.test(detalle)) {
    return "No se pudo conectar al servidor de correo. Revisa EMAIL_HOST y EMAIL_PORT.";
  }
  return "No se pudo enviar el correo.";
}

/**
 * Envía un correo HTML por SMTP. Nunca lanza: devuelve el error ya traducido para
 * que las Server Actions lo pasen directo al `ActionState`.
 */
export async function enviarCorreo(correo: CorreoSalida): Promise<ResultadoEnvio> {
  const config = leerConfig();
  if ("error" in config) return { ok: false, error: config.error };

  const para = (Array.isArray(correo.para) ? correo.para : [correo.para])
    .map((d) => d.trim())
    .filter(Boolean);
  if (para.length === 0) return { ok: false, error: "No hay destinatarios." };

  let sesion: SesionSmtp | null = null;
  try {
    sesion = await conectar(config.host, config.puerto, config.tlsImplicito);

    const saludo = await sesion.esperar();
    if (saludo.codigo !== 220) throw new Error(`SMTP ${saludo.codigo}: ${saludo.texto}`);

    await sesion.ordenar(`EHLO ${config.dominio}`, 250);

    if (!config.tlsImplicito) {
      await sesion.ordenar("STARTTLS", 220);
      await sesion.iniciarTls(config.host);
      // Tras cifrar hay que volver a presentarse: el servidor descarta el estado previo.
      await sesion.ordenar(`EHLO ${config.dominio}`, 250);
    }

    await sesion.ordenar("AUTH LOGIN", 334);
    await sesion.ordenar(Buffer.from(config.usuario, "utf8").toString("base64"), 334);
    await sesion.ordenar(Buffer.from(config.clave, "utf8").toString("base64"), 235);

    await sesion.ordenar(`MAIL FROM:<${config.usuario}>`, 250);
    for (const destinatario of para) {
      await sesion.ordenar(`RCPT TO:<${destinatario}>`, 250, 251);
    }

    await sesion.ordenar("DATA", 354);
    sesion.escribir(construirMensaje(config, para, correo));
    await sesion.ordenar(".", 250);

    return { ok: true };
  } catch (error) {
    console.error("[email] fallo SMTP:", error);
    return { ok: false, error: mensajeAmable(error) };
  } finally {
    sesion?.cerrar();
  }
}
