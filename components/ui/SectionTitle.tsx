export function SectionTitle({
  kicker,
  title,
  dark = false,
  id,
}: {
  kicker: string;
  title: string;
  dark?: boolean;
  id?: string;
}) {
  return (
    <div id={id} className="mb-10 scroll-mt-24">
      <p className="text-sm font-bold uppercase tracking-widest text-electric-600">{kicker}</p>
      <h2
        className={`mt-2 text-3xl font-bold tracking-tight sm:text-4xl ${
          dark ? "text-white" : "text-navy-950"
        }`}
      >
        {title}
      </h2>
    </div>
  );
}
