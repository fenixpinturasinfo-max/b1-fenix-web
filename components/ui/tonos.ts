/**
 * Semántica de color del dashboard.
 * El tono nunca es la única señal: siempre va acompañado de ícono y texto.
 */

export type Tono = "critico" | "atencion" | "info" | "ok" | "neutro";

export const tonoChip: Record<Tono, string> = {
  critico: "text-fenix-600 bg-fenix-600/10",
  atencion: "text-[#b45309] bg-[#f59e0b]/15",
  info: "text-electric-600 bg-electric-50",
  ok: "text-[#4d7c0f] bg-lime-400/15",
  neutro: "text-slate-500 bg-cloud",
};

export const tonoBorde: Record<Tono, string> = {
  critico: "border-fenix-600/30",
  atencion: "border-[#f59e0b]/40",
  info: "border-slate-200",
  ok: "border-lime-400/40",
  neutro: "border-slate-200",
};

export const tonoTexto: Record<Tono, string> = {
  critico: "text-fenix-600",
  atencion: "text-[#b45309]",
  info: "text-electric-600",
  ok: "text-[#4d7c0f]",
  neutro: "text-slate-500",
};
