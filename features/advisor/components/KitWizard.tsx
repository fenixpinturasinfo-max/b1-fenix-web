"use client";

import { useState } from "react";
import { goals, recommendKit, sizesByGoal, type Goal } from "../kits";
import { useCart } from "@/features/cart/store";
import { formatCLP } from "@/lib/format";
import { buildAdvisoryUrl } from "@/lib/whatsapp";

type Step = "goal" | "size" | "result";

export function KitWizard() {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("goal");
  const add = useCart((s) => s.add);

  const pickGoal = (g: Goal) => {
    setGoal(g);
    setSize(null);
    setStep(sizesByGoal[g] ? "size" : "result");
  };

  const kit = goal ? recommendKit(goal, size ?? undefined) : [];
  const total = kit.reduce((n, p) => n + p.precioVenta, 0);

  const reset = () => {
    setGoal(null);
    setSize(null);
    setStep("goal");
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-10">
      {step === "goal" && (
        <>
          <p className="mb-6 text-center font-semibold text-slate-700">
            1 de 2 · ¿Qué necesitas hacer?
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {goals.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => pickGoal(g.id)}
                className="group flex flex-col items-center gap-2 rounded-2xl border-2 border-slate-200 p-6 text-center transition hover:-translate-y-0.5 hover:border-fenix-500"
              >
                <span className="text-4xl" aria-hidden="true">{g.icon}</span>
                <span className="font-bold text-navy-950">{g.label}</span>
                <span className="text-sm text-slate-500">{g.descripcion}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {step === "size" && goal && (
        <>
          <p className="mb-6 text-center font-semibold text-slate-700">
            2 de 2 · ¿Qué tan grande es el trabajo?
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {sizesByGoal[goal]?.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSize(s.id);
                  setStep("result");
                }}
                className="rounded-2xl border-2 border-slate-200 p-6 text-center font-bold text-navy-950 transition hover:-translate-y-0.5 hover:border-fenix-500"
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={reset}
            className="mx-auto mt-6 block text-sm font-semibold text-slate-500 hover:text-navy-950"
          >
            ← Volver
          </button>
        </>
      )}

      {step === "result" && (
        <>
          <p className="mb-6 text-center font-semibold text-slate-700">
            ✅ Tu kit recomendado
          </p>
          <ul className="mx-auto max-w-md space-y-3">
            {kit.map((p) => (
              <li
                key={p.sku}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-cloud/60 px-4 py-3"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-fenix-600">{p.marca}</p>
                  <p className="font-semibold text-navy-950">{p.nombre}</p>
                </div>
                <span className="font-bold text-navy-950">{formatCLP(p.precioVenta)}</span>
              </li>
            ))}
          </ul>
          <div className="mx-auto mt-5 flex max-w-md items-center justify-between">
            <span className="text-slate-600">Total del kit</span>
            <span className="text-xl font-bold text-navy-950">{formatCLP(total)}</span>
          </div>
          <div className="mx-auto mt-6 flex max-w-md flex-col gap-3">
            <button
              type="button"
              onClick={() => kit.forEach((p) => add(p))}
              className="bg-flame h-12 rounded-xl font-bold text-white transition hover:opacity-90"
            >
              Agregar kit al carro
            </button>
            <a
              href={buildAdvisoryUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center rounded-xl border border-slate-300 font-semibold text-navy-950 transition hover:border-fenix-500"
            >
              Prefiero que me asesore un experto
            </a>
            <button
              type="button"
              onClick={reset}
              className="text-sm font-semibold text-slate-500 hover:text-navy-950"
            >
              ← Empezar de nuevo
            </button>
          </div>
        </>
      )}
    </div>
  );
}
