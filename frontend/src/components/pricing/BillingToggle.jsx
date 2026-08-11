import { motion } from "framer-motion";

export default function BillingToggle({ yearly, setYearly }) {
  return (
    <div className="inline-flex rounded-full bg-slate-900 border border-slate-700 p-1">

      <button
        onClick={() => setYearly(false)}
        className={`relative px-8 py-3 rounded-full text-sm font-semibold transition ${
          !yearly ? "text-white" : "text-slate-400"
        }`}
      >
        {!yearly && (
          <motion.div
            layoutId="billing"
            className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600"
          />
        )}

        <span className="relative z-10">
          Monthly
        </span>

      </button>

      <button
        onClick={() => setYearly(true)}
        className={`relative px-8 py-3 rounded-full text-sm font-semibold transition ${
          yearly ? "text-white" : "text-slate-400"
        }`}
      >
        {yearly && (
          <motion.div
            layoutId="billing"
            className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600"
          />
        )}

        <span className="relative z-10">
          Yearly
          <span className="ml-2 rounded-full bg-green-500/20 px-2 py-1 text-xs text-green-400">
            Save 20%
          </span>
        </span>

      </button>
    </div>
  );
}