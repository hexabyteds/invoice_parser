import { motion } from "framer-motion";
import { Check } from "lucide-react";

export default function PricingCard({ plan }) {
  return (
    <motion.div
      whileHover={{
        y: -10,
        scale: 1.02
      }}
      className={`relative rounded-3xl border ${
        plan.popular
          ? "border-blue-500 shadow-2xl shadow-blue-500/20"
          : "border-slate-800"
      } bg-slate-900 p-8`}
    >
      {plan.popular && (
        <div className="absolute right-6 top-6 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold">
          Most Popular
        </div>
      )}

      <h3 className="text-3xl font-bold">
        {plan.name}
      </h3>

      <p className="mt-3 text-slate-400">
        {plan.description}
      </p>

      <div className="mt-8 flex items-end gap-2">

        <span className="text-6xl font-black">

          {typeof plan.price === "number"
            ? `$${plan.price}`
            : plan.price}

        </span>

        {typeof plan.price === "number" && (
          <span className="pb-2 text-slate-400">
            /month
          </span>
        )}

      </div>

      <button
        className={`mt-8 w-full rounded-xl py-4 font-semibold transition ${
          plan.popular
            ? "bg-blue-600 hover:bg-blue-700"
            : "border border-slate-700 hover:bg-slate-800"
        }`}
      >
        {plan.button}
      </button>

      <div className="mt-10 space-y-4">

        {plan.features.map((feature) => (
          <div
            key={feature}
            className="flex items-center gap-3"
          >
            <Check
              size={18}
              className="text-green-400"
            />

            <span className="text-slate-300">
              {feature}
            </span>

          </div>
        ))}

      </div>

    </motion.div>
  );
} 