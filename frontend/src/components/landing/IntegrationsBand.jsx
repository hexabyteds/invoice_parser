const integrations = ["QuickBooks", "Zoho Books", "Excel / CSV"];

export default function IntegrationsBand() {
  return (
    <section className="border-y border-slate-800 bg-slate-950/60">
      <div className="mx-auto max-w-7xl px-6 py-14 sm:px-8">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Works with the tools you already use
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          {integrations.map((name) => (
            <span
              key={name}
              className="rounded-full border border-slate-800 bg-slate-900 px-6 py-3 text-base font-semibold text-slate-300"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
