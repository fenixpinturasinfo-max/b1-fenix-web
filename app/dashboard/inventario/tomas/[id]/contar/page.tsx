import { notFound, redirect } from "next/navigation";
import { requireSeccion } from "@/lib/auth/guards";
import { esRolGlobal } from "@/lib/auth/permissions";
import { tomaDetalle } from "@/features/tomas/queries";
import { alcanceLabel } from "@/features/tomas/toma";
import { ContadorMovil } from "@/features/tomas/components/ContadorMovil";

export default async function ContarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSeccion("inventario.toma");
  const { id } = await params;

  const toma = await tomaDetalle(id, { paraContar: true });
  if (!toma) notFound();
  if (!esRolGlobal(session.rol) && toma.localId !== session.localId) notFound();
  // Cerrada ya no se cuenta: se revisa
  if (toma.estado !== "ABIERTA") redirect(`/dashboard/inventario/tomas/${id}`);

  return (
    <ContadorMovil
      tomaId={toma.id}
      folio={toma.folio}
      localNombre={toma.localNombre}
      descripcion={`${alcanceLabel[toma.alcance] ?? toma.alcance}${toma.filtro ? ` · ${toma.filtro}` : ""}`}
      lineas={toma.lineas}
      ciego={toma.ciego}
    />
  );
}
