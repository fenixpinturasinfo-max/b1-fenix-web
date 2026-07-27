/** Skeleton de carga: se muestra al instante mientras el servidor consulta la BD */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-label="Cargando…">
      <div className="space-y-2">
        <div className="h-7 w-64 rounded-lg bg-slate-200/70" />
        <div className="h-4 w-96 max-w-full rounded-lg bg-slate-200/50" />
      </div>
      <div className="flex gap-2">
        <div className="h-10 w-28 rounded-full bg-slate-200/60" />
        <div className="h-10 w-28 rounded-full bg-slate-200/60" />
        <div className="h-10 w-40 rounded-xl bg-slate-200/60" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
