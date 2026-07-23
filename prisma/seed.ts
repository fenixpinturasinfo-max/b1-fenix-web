/**
 * Seed inicial: locales, categorías, productos (desde el mock del catálogo),
 * stock y usuario administrador.
 *
 * Ejecutar: npx prisma db seed
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { categories, products } from "../features/catalog/data/products";
import { locations } from "../features/stores/data/locations";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Locales ──
  const localCodes: Record<string, string> = { "san-bernardo": "SB", buin: "BU" };
  const localIds: Record<string, string> = {};
  for (const l of locations) {
    const local = await prisma.local.upsert({
      where: { codigo: localCodes[l.id] },
      update: { nombre: l.nombre, direccion: l.direccion, comuna: l.comuna, horario: l.horario },
      create: {
        codigo: localCodes[l.id],
        nombre: l.nombre,
        direccion: l.direccion,
        comuna: l.comuna,
        horario: l.horario,
      },
    });
    localIds[l.id] = local.id;
  }
  console.log(`✓ ${locations.length} locales`);

  // ── Categorías ──
  const catIds: Record<string, string> = {};
  for (const c of categories) {
    const cat = await prisma.categoria.upsert({
      where: { slug: c.id },
      update: { nombre: c.nombre },
      create: { slug: c.id, nombre: c.nombre },
    });
    catIds[c.id] = cat.id;
  }
  console.log(`✓ ${categories.length} categorías`);

  // ── Productos + stock ──
  let nProductos = 0;
  for (const p of products) {
    const producto = await prisma.producto.upsert({
      where: { sku: p.sku },
      update: {
        nombre: p.nombre,
        marca: p.marca,
        precioVenta: p.precioVenta,
        precioAnterior: p.precioAnterior ?? null,
        destacado: p.destacado ?? false,
        categoriaId: catIds[p.categoria],
      },
      create: {
        sku: p.sku,
        slug: p.slug,
        nombre: p.nombre,
        marca: p.marca,
        categoriaId: catIds[p.categoria],
        precioVenta: p.precioVenta,
        precioAnterior: p.precioAnterior ?? null,
        destacado: p.destacado ?? false,
      },
    });
    nProductos++;

    if (p.stock) {
      for (const [localSlug, cantidad] of Object.entries(p.stock)) {
        const localId = localIds[localSlug];
        if (!localId) continue;
        await prisma.stockLocal.upsert({
          where: { productoId_localId: { productoId: producto.id, localId } },
          update: { cantidad },
          create: { productoId: producto.id, localId, cantidad, stockMin: 2 },
        });
      }
    }
  }
  console.log(`✓ ${nProductos} productos`);

  // ── Usuario administrador ──
  const adminEmail = "admin@pinturasfenix.cl";
  const adminPassword = "Fenix2026!"; // ⚠️ cambiar después del primer login
  await prisma.usuario.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      nombre: "Administrador",
      rol: "ADMINISTRADOR",
    },
  });
  console.log(`✓ admin: ${adminEmail} / ${adminPassword}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
