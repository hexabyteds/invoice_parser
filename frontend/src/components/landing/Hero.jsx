import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-40">

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#2563eb33,transparent_40%),radial-gradient(circle_at_bottom_left,#7c3aed22,transparent_40%)]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-20 px-8 lg:grid-cols-2">

        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: .8 }}
        >

          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-400">
            AI Powered Finance Platform
          </span>

          <h1 className="mt-8 text-6xl font-black leading-tight text-white">
            The Intelligent Platform
            <br />
            for Invoice Processing
            <br />
            & Factorization
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-8 text-slate-400">
            Automate invoice extraction, AI validation,
            financing workflows, approvals and analytics
            from one intelligent platform.
          </p>

          <div className="mt-10 flex gap-5">

            <button className="flex items-center gap-2 rounded-full bg-blue-600 px-7 py-4 font-semibold hover:bg-blue-500">
              Start Free
              <ArrowRight size={18} />
            </button>

            <button className="rounded-full border border-slate-700 px-7 py-4 hover:bg-slate-900">
              Book Demo
            </button>

          </div>

        </motion.div>

        <motion.div
          initial={{ opacity:0, x:40 }}
          animate={{ opacity:1, x:0 }}
          transition={{ duration:.8 }}
        >

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">

            <div className="mb-6 flex justify-between">

              <div>
                <p className="text-slate-400">Invoices Today</p>
                <h2 className="mt-2 text-4xl font-bold text-white">
                  1,284
                </h2>
              </div>

              <div>
                <p className="text-slate-400">AI Accuracy</p>
                <h2 className="mt-2 text-4xl font-bold text-green-400">
                  99.8%
                </h2>
              </div>

            </div>

            <div className="mt-8 h-72 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-slate-500">
              Dashboard Preview
            </div>

          </div>

        </motion.div>

      </div>

    </section>
  );
}