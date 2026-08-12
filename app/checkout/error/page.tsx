export const metadata = { robots: { index: false } };

const MENSAJES: Record<string, { titulo: string; detalle: string }> = {
  rechazado: {
    titulo: "El pago no fue autorizado",
    detalle:
      "Tu banco rechazó la transacción: no se cobró nada. Revisa los datos de la tarjeta o intenta con otra — tu carro sigue guardado.",
  },
  abandono: {
    titulo: "Pago cancelado",
    detalle: "Saliste de Webpay sin completar el pago. No se cobró nada y tu carro sigue guardado.",
  },
  desconocido: {
    titulo: "No pudimos confirmar el pago",
    detalle:
      "Algo se interrumpió al volver de Webpay. Si el banco te descontó, escríbenos por WhatsApp con la hora de la compra y lo resolvemos.",
  },
};

export default async function ErrorPagoPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const msg = MENSAJES[m ?? ""] ?? MENSAJES.desconocido;

  return (
    <main className="flex min-h-screen items-center justify-center bg-cloud p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <p className="text-5xl">😕</p>
        <h1 className="mt-3 text-xl font-black text-navy-950">{msg.titulo}</h1>
        <p className="mt-2 text-sm text-slate-500">{msg.detalle}</p>
        <a
          href="/checkout"
          className="bg-flame mt-6 block h-12 w-full rounded-xl text-center font-bold leading-[48px] text-white transition hover:opacity-90"
        >
          Reintentar el pago
        </a>
        <a href="/" className="mt-3 block text-sm font-semibold text-slate-500 hover:text-electric-600">
          Volver a la tienda
        </a>
      </div>
    </main>
  );
}
