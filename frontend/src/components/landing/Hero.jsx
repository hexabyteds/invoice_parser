import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-40">

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#4f46e533,transparent_40%),radial-gradient(circle_at_bottom_left,#7c3aed22,transparent_40%)]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-20 px-8 lg:grid-cols-2">

        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: .8 }}
        >

          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-400">
            AI Accounting Platform
          </span>

          <h1 className="mt-8 text-4xl sm:text-5xl lg:text-6xl font-extrabold font-display leading-tight tracking-tight text-white text-balance">
            Turn Any Invoice Into
            <br />
            Clean, Exportable Books
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-8 text-slate-400">
            Upload a PDF or photo and get structured, categorized
            invoice data in seconds. Export straight to QuickBooks,
            Zoho, or Xero — no manual entry, no per-seat pricing.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:gap-5">

            <Link
              to="/register"
              className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-7 py-4 font-semibold text-white shadow-lg shadow-indigo-950/30 transition-all hover:from-indigo-500 hover:to-violet-500"
            >
              Start Free — No Card Required
              <ArrowRight size={18} />
            </Link>

            <a
              href="mailto:sales@eazeebooks.com?subject=Book%20a%20demo"
              className="flex items-center justify-center rounded-full border border-slate-700 px-7 py-4 hover:bg-slate-900"
            >
              Book Demo
            </a>

          </div>

        </motion.div>

        <motion.div
          initial={{ opacity:0, x:40 }}
          animate={{ opacity:1, x:0 }}
          transition={{ duration:.8 }}
        >

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">

            <div className="mb-6 flex items-center justify-between">

              <div>
                <p className="text-slate-400">Upload</p>
                <h2 className="mt-2 text-3xl font-bold text-white">
                  PDF or photo
                </h2>
              </div>

              <div>
                <p className="text-slate-400">Export to</p>
                <h2 className="mt-2 text-3xl font-bold text-white">
                  Books & Excel
                </h2>
              </div>

            </div>

            {/* Mock product glimpse — illustrative sample data, not a live customer's figures */}
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
              Sample workspace
            </p>
            <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">

              <div className="flex items-end justify-between gap-2 h-28">
                {[38, 62, 48, 80, 56, 92, 70, 100, 78, 60].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: 0.4 + i * 0.05, duration: 0.5 }}
                    className="flex-1 rounded-t-md bg-gradient-to-t from-indigo-600 to-violet-500"
                  />
                ))}
              </div>

              <div className="mt-5 space-y-3 border-t border-slate-800 pt-4">
                {[
                  { name: "INV-4471 · Vendor A", amount: "AED 12,450.00", status: "Processed" },
                  { name: "INV-4472 · Vendor B", amount: "AED 3,180.75", status: "Processed" },
                  { name: "INV-4473 · Vendor C", amount: "AED 940.20", status: "Reviewing" },
                ].map((row) => (
                  <div key={row.name} className="flex items-center justify-between text-sm">
                    <span className="truncate text-slate-300">{row.name}</span>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-medium text-white">{row.amount}</span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          row.status === "Processed"
                            ? "bg-green-500/10 text-green-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {row.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

            </div>

          </div>

        </motion.div>

      </div>

    </section>
  );
}