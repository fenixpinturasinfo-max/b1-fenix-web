/**
 * Usuarios de prueba: un equipo completo por local, más los dos roles globales.
 *
 * Sirve para recorrer los 5 dashboards y verificar que cada perfil ve solo lo suyo.
 *
 *   npx prisma migrate dev          ← primero: el rol GERENTE necesita su migración
 *   npx tsx prisma/seed-usuarios.ts
 *
 * Es idempotente: se puede correr las veces que sea. En cuentas que ya existen
 * sincroniza nombre, rol, local y estado, pero NO pisa la contraseña. Para volver
 * a dejar todas con la clave por defecto:
 *
 *   RESET=1 npx tsx prisma/seed-usuarios.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

/** Clave única para todas las cuentas de prueba. Cambiar antes de usar en producción. */
const CLAVE = "Fenix2026!";
const RESETEAR = process.env.RESET === "1";

/** Código del local que actúa como casa matriz (recibe las solicitudes de reposición) */
const CODIGO_MATRIZ = "SB";

type Rol = "ADMINISTRADOR" | "GERENTE" | "JEFE_LOCAL" | "VENDEDOR" | "BODEGA";

interface Cuenta {
  email: string;
  nombre: string;
  rol: Rol;
  /** Código del local, o null para los roles con visión de toda la cadena */
  local: string | null;
  para: string;
}

const CUENTAS: Cuenta[] = [
  // ── Roles globales (sin local: ven la cadena completa) ──
  {
    email: "admin@pinturasfenix.cl",
    nombre: "Administrador",
    rol: "ADMINISTRADOR",
    local: null,
    para: "Dashboard consolidado + salud del sistema. Único que ve Usuarios y Locales.",
  },
  {
    email: "gerente@pinturasfenix.cl",
    nombre: "Gerencia",
    rol: "GERENTE",
    local: null,
    para: "Dashboard consolidado sin configuración. No ve Usuarios ni Locales.",
  },

  // ── Fenix San Bernardo (casa matriz) ──
  {
    email: "jefe.sb@pinturasfenix.cl",
    nombre: "Encargado San Bernardo",
    rol: "JEFE_LOCAL",
    local: "SB",
    para: "Dashboard de local. Al ser matriz, resuelve las solicitudes de todos los locales.",
  },
  {
    email: "vendedor.sb@pinturasfenix.cl",
    nombre: "Vendedor San Bernardo",
    rol: "VENDEDOR",
    local: "SB",
    para: "Dashboard de caja. Solo POS: no ve inventario ni compras.",
  },
  {
    email: "bodega.sb@pinturasfenix.cl",
    nombre: "Bodega San Bernardo",
    rol: "BODEGA",
    local: "SB",
    para: "Dashboard de pendientes. Inventario y recepciones, sin acceso al POS.",
  },

  // ── Fenix Buin ──
  {
    email: "jefe.bu@pinturasfenix.cl",
    nombre: "Encargado Buin",
    rol: "JEFE_LOCAL",
    local: "BU",
    para: "Mismo perfil que el de San Bernardo, pero sin resolver solicitudes (no es matriz).",
  },
  {
    email: "vendedor.bu@pinturasfenix.cl",
    nombre: "Vendedor Buin",
    rol: "VENDEDOR",
    local: "BU",
    para: "Para verificar que no ve las ventas ni la caja de San Bernardo.",
  },
  {
    email: "bodega.bu@pinturasfenix.cl",
    nombre: "Bodega Buin",
    rol: "BODEGA",
    local: "BU",
    para: "Para verificar que su stock y sus quiebres son solo los de Buin.",
  },
];

async function main() {
  // ── Locales ──
  const locales = await prisma.local.findMany({
    where: { activo: true },
    select: { id: true, codigo: true, nombre: true, esMatriz: true },
  });
  const porCodigo = new Map(locales.map((l) => [l.codigo, l]));

  if (locales.length === 0) {
    throw new Error("No hay locales activos. Corre primero `npm run db:seed`.");
  }

  const faltantes = [...new Set(CUENTAS.map((c) => c.local).filter(Boolean))].filter(
    (c) => !porCodigo.has(c as string),
  );
  if (faltantes.length > 0) {
    throw new Error(
      `Faltan locales con código ${faltantes.join(", ")}. Créalos en /dashboard/locales o ajusta este script.`,
    );
  }

  // ── Casa matriz ──
  // Sin matriz definida, las solicitudes de reposición no tienen a quién ir y el
  // dashboard del jefe de local no sabe quién resuelve.
  const matriz = porCodigo.get(CODIGO_MATRIZ)!;
  if (!matriz.esMatriz) {
    await prisma.local.updateMany({ where: { esMatriz: true }, data: { esMatriz: false } });
    await prisma.local.update({ where: { id: matriz.id }, data: { esMatriz: true } });
    console.log(`✓ ${matriz.nombre} marcado como casa matriz`);
  } else {
    console.log(`· ${matriz.nombre} ya era la casa matriz`);
  }

  // ── Cuentas ──
  const hash = await bcrypt.hash(CLAVE, 10);
  let creadas = 0;
  let actualizadas = 0;

  for (const c of CUENTAS) {
    const localId = c.local ? porCodigo.get(c.local)!.id : null;
    const existe = await prisma.usuario.findUnique({
      where: { email: c.email },
      select: { id: true },
    });

    await prisma.usuario.upsert({
      where: { email: c.email },
      // Sincroniza rol, local y estado; la clave solo se toca con RESET=1
      update: {
        nombre: c.nombre,
        rol: c.rol,
        localId,
        activo: true,
        ...(RESETEAR ? { passwordHash: hash } : {}),
      },
      create: {
        email: c.email,
        nombre: c.nombre,
        rol: c.rol,
        localId,
        passwordHash: hash,
      },
    });

    if (existe) actualizadas++;
    else creadas++;
    const donde = c.local ? porCodigo.get(c.local)!.nombre : "todos los locales";
    console.log(`  ${existe ? "·" : "+"} ${c.email.padEnd(32)} ${c.rol.padEnd(14)} ${donde}`);
  }

  console.log(`\n✓ ${creadas} creadas, ${actualizadas} ya existían`);
  console.log(`  Clave de las cuentas nuevas: ${CLAVE}`);
  if (actualizadas > 0 && !RESETEAR) {
    console.log("  Las que ya existían conservan su clave. Usa RESET=1 para igualarlas todas.");
  }
  console.log("\n⚠️  Son cuentas de prueba. Desactívalas antes de salir a producción.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("\n✗ Error:", e instanceof Error ? e.message : e);
    if (String(e).includes("GERENTE")) {
      console.error("  Falta la migración del rol GERENTE. Corre: npx prisma migrate dev");
    }
    await prisma.$disconnect();
    process.exit(1);
  });
