import { motion } from "framer-motion";

const steps = [
  ["01", "Upload", "Drop in a PDF or photo of any invoice."],
  ["02", "Extract", "AI reads it and structures every field."],
  ["03", "Review", "Check the data, fix anything that needs it."],
  ["04", "Export", "Send it to QuickBooks, Zoho, Xero, or Excel."],
];

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-400">
          How it works
        </p>
        <h2 className="mt-4 text-4xl font-bold font-display tracking-tight text-white sm:text-5xl">
          From document to usable data.
        </h2>
        <p className="mt-5 text-lg text-slate-400">
          Four steps, no manual re-typing.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 md:grid-cols-4">
        {steps.map(([number, title, description], index) => (
          <motion.div
            key={number}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: index * 0.08 }}
            className={`p-8 ${
              index !== steps.length - 1
                ? "border-b border-slate-800 md:border-b-0 md:border-r"
                : ""
            }`}
          >
            <span className="font-mono text-xs tracking-[0.15em] text-slate-500">
              {number}
            </span>
            <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
            <p className="mt-2 text-slate-400">{description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
