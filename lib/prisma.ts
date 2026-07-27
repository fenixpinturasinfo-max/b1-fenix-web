import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Singleton para evitar múltiples conexiones en dev (hot reload)
// y optimizado para el entorno serverless de Vercel.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Neon suspende conexiones inactivas: reciclarlas antes evita
    // los "Error in PostgreSQL connection: TimedOut" en la consola.
    max: 5, // pocas conexiones (Neon pooler + serverless)
    idleTimeoutMillis: 30_000, // cerrar conexiones ociosas a los 30 s
    connectionTimeoutMillis: 10_000, // no esperar más de 10 s por una conexión
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
