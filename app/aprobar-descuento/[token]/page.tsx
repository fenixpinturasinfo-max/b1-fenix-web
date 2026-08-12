import { ResolucionCorreo } from "@/features/descuentos/components/ResolucionCorreo";

/**
 * Destino de los enlaces del correo de autorización de descuentos.
 *
 * Vive fuera de /dashboard a propósito: el gerente aprueba desde el teléfono sin iniciar
 * sesión. La credencial es el token firmado de la URL —personal, con vencimiento y de un
 * solo uso efectivo—, y la resolución corre como Server Action desde el cliente para que
 * los escáneres de correo que visitan enlaces no aprueben nada por su cuenta.
 */
export default async function AprobarDescuentoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-cloud p-4">
      <div className="w-full max-w-md">
        <p className="mb-4 text-center text-sm font-black tracking-wide text-navy-950">
          PINTURAS FENIX
        </p>
        <ResolucionCorreo token={decodeURIComponent(token)} />
      </div>
    </main>
  );
}
