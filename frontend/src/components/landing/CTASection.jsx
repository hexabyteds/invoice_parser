import { Link } from "react-router-dom";

export default function CTASection() {
  return (
    <section className="px-6 pb-24 sm:px-8">
      <div className="mx-auto max-w-6xl rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 px-8 py-16 text-center sm:px-16">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
          Ready to start?
        </p>

        <h2 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
          Turn your invoices into structured data.
        </h2>

        <p className="mx-auto mt-6 max-w-xl text-lg text-slate-400">
          Upload your first invoice and see how much manual bookkeeping
          work you can remove from your workflow.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/register"
            className="rounded-full bg-blue-600 px-8 py-4 font-semibold text-white transition hover:bg-blue-500"
          >
            Start Free — No Card Required
          </Link>

          <Link
            to="/price"
            className="rounded-full border border-slate-700 px-8 py-4 font-semibold text-white transition hover:bg-slate-900"
          >
            View pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
