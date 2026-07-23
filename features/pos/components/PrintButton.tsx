"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-flame h-11 rounded-xl px-6 font-bold text-white transition hover:opacity-90 print:hidden"
    >
      🖨 Imprimir boleta
    </button>
  );
}
