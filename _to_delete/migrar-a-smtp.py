#!/usr/bin/env python3
"""Reemplaza las llamadas a la API de Resend por el cliente SMTP de lib/email.ts.

Cada sustitución se verifica: si el texto original no aparece exactamente una vez,
el script aborta sin escribir nada. Es idempotente — si ya se aplicó, no hace nada.
"""
import sys
from pathlib import Path

RAIZ = Path(sys.argv[1] if len(sys.argv) > 1 else ".")

CAMBIOS = {
    "features/pos/actions.ts": [
        (
            'import { formatCLP } from "@/lib/format";\n',
            'import { formatCLP } from "@/lib/format";\nimport { enviarCorreo } from "@/lib/email";\n',
        ),
        (
            """    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { error: "Envío por correo no configurado (falta RESEND_API_KEY)." };
    }

""",
            "",
        ),
        (
            """    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Pinturas Fenix <onboarding@resend.dev>",
        to: [email],
        subject: `Boleta ${folio} · Pinturas Fenix`,
        html,
      }),
    });

    if (!res.ok) {
      return { error: "No se pudo enviar el correo. Revisa la configuración de Resend." };
    }
""",
            """    const envio = await enviarCorreo({
      para: email,
      asunto: `Boleta ${folio} · Pinturas Fenix`,
      html,
    });
    // El motivo real ya viene traducido desde lib/email.ts (credenciales, host, etc.).
    if (!envio.ok) return { error: envio.error };
""",
        ),
    ],
    "features/supply/actions.ts": [
        (
            'import { exigirEscritura } from "@/lib/auth/guards";\n',
            'import { exigirEscritura } from "@/lib/auth/guards";\nimport { enviarCorreo } from "@/lib/email";\n',
        ),
        (
            """    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { error: "Envío por correo no configurado (falta RESEND_API_KEY)." };

""",
            "",
        ),
        (
            """    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Pinturas Fenix <onboarding@resend.dev>",
        to: [email],
        subject: `Solicitud de cotización${numeroRef ? ` ${numeroRef}` : ""} · Pinturas Fenix (${solicitudes.length} productos)`,
        html,
      }),
    });
    if (!res.ok) {
      // Superficie el motivo real que entrega Resend (dominio no verificado, key inválida, etc.)
      let detalle = "";
      try {
        const body = (await res.json()) as { message?: string };
        detalle = body.message ?? "";
      } catch {
        /* sin cuerpo JSON */
      }
      console.error("Resend error", res.status, detalle);
      return {
        error: `No se pudo enviar el correo${detalle ? `: ${detalle}` : ` (HTTP ${res.status})`}.`,
      };
    }
""",
            """    const envio = await enviarCorreo({
      para: email,
      asunto: `Solicitud de cotización${numeroRef ? ` ${numeroRef}` : ""} · Pinturas Fenix (${solicitudes.length} productos)`,
      html,
    });
    // El motivo real ya viene traducido desde lib/email.ts (credenciales, host, etc.).
    if (!envio.ok) return { error: envio.error };
""",
        ),
    ],
}

fallos = []
pendientes = {}

for relativo, reemplazos in CAMBIOS.items():
    ruta = RAIZ / relativo
    if not ruta.exists():
        fallos.append(f"{relativo}: no existe")
        continue
    texto = ruta.read_text(encoding="utf-8")
    for viejo, nuevo in reemplazos:
        apariciones = texto.count(viejo)
        if apariciones == 0:
            if nuevo and nuevo in texto:
                continue  # ya aplicado
            fallos.append(f"{relativo}: no se encontró el bloque\n{viejo[:90]}...")
            continue
        if apariciones > 1:
            fallos.append(f"{relativo}: el bloque aparece {apariciones} veces, se esperaba 1")
            continue
        texto = texto.replace(viejo, nuevo, 1)
    pendientes[ruta] = texto

if fallos:
    print("ABORTADO, no se escribió nada:")
    for f in fallos:
        print(" ·", f)
    sys.exit(1)

for ruta, texto in pendientes.items():
    ruta.write_text(texto, encoding="utf-8")
    print("actualizado:", ruta.relative_to(RAIZ))

print("listo")
