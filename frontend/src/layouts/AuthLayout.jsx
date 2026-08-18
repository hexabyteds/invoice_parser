import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, Download, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

const capabilities = [
  {
    icon: Sparkles,
    label: "AI extraction",
    value: "Structured in seconds",
  },
  {
    icon: Download,
    label: "Export to",
    value: "QuickBooks, Zoho Books",
  },
  {
    icon: ShieldCheck,
    label: "Access",
    value: "Role-based, encrypted",
  },
];

// `variant="minimal"` is for Login — a focused, professional sign-in screen,
// not another marketing surface. `variant="full"` (default) is for Register,
// the one screen where reinforcing product value during the conversion
// moment earns its place — but still without invented stats/activity feeds.
export default function AuthLayout({ title, subtitle, children, variant = "full" }) {
  const isMinimal = variant === "minimal";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-white">

      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#2563eb30,transparent_35%),radial-gradient(circle_at_bottom_right,#7c3aed25,transparent_40%)]" />

      <div className="relative flex min-h-screen">

        {/* LEFT PANEL */}

        <div className="hidden lg:flex w-1/2 border-r border-slate-800">

          <div className={`flex w-full flex-col px-16 py-14 ${isMinimal ? "justify-center" : "justify-between"}`}>

            {/* Header */}

            <div className={isMinimal ? "absolute top-14 left-16" : ""}>

              <Link
                to="/"
                className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition"
              >
                <ArrowLeft size={18} />
                Back to Home
              </Link>

            </div>

            <div>

              <div className={`flex items-center gap-4 ${isMinimal ? "" : "mt-12"}`}>

                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-2xl font-bold shadow-lg shadow-indigo-950/40">
                  EB
                </div>

                <div>
                  <h1 className="text-3xl font-bold font-display tracking-tight">
                    EazeeBooks
                  </h1>

                  <p className="text-slate-400">
                    AI Accounting Platform
                  </p>
                </div>

              </div>

              {isMinimal ? (
                <p className="mt-8 max-w-md text-lg leading-8 text-slate-400">
                  Sign in to review extracted invoices, manage clients, and
                  export straight to your bookkeeping workflow.
                </p>
              ) : (
                <>
                  <motion.h2
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-16 text-6xl font-extrabold font-display leading-tight tracking-tight"
                  >
                    The Future of
                    <br />
                    Invoice
                    <span className="bg-gradient-to-r from-indigo-400 to-violet-500 bg-clip-text text-transparent">
                      {" "}Processing
                    </span>
                  </motion.h2>

                  <p className="mt-8 max-w-xl text-lg leading-8 text-slate-400">
                    Automate invoice extraction, AI validation, client
                    workspaces, and exports from one intelligent platform.
                  </p>
                </>
              )}

            </div>

            {!isMinimal && (
              <>
                {/* Capabilities — descriptive, not invented metrics */}

                <div className="grid grid-cols-3 gap-5 mt-10">

                  {capabilities.map(({ icon: Icon, label, value }) => (
                    <motion.div
                      key={label}
                      whileHover={{ y: -5 }}
                      className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
                    >
                      <Icon className="text-indigo-400" aria-hidden="true" />
                      <p className="mt-5 text-sm text-slate-400">
                        {label}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold leading-snug">
                        {value}
                      </h3>
                    </motion.div>
                  ))}

                </div>

                {/* Sample workspace glimpse — explicitly labeled illustrative data */}

                <div className="mt-10 rounded-3xl border border-slate-800 bg-slate-900 p-8">

                  <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
                    Sample workspace
                  </p>

                  <div className="mt-6 flex h-40 items-end justify-between gap-3">

                    {[35, 55, 45, 80, 60, 90, 70, 60].map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ delay: i * 0.05 }}
                        className="w-full rounded-t-xl bg-gradient-to-t from-indigo-600 to-violet-500"
                      />
                    ))}

                  </div>

                  <div className="mt-6 space-y-3 border-t border-slate-800 pt-5">
                    {[
                      { name: "INV-1024 · Vendor A", status: "Processed" },
                      { name: "INV-1025 · Vendor B", status: "Reviewing" },
                      { name: "INV-1026 · Vendor C", status: "Processed" },
                    ].map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{item.name}</span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.status === "Processed"
                              ? "bg-green-500/10 text-green-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>

                </div>
              </>
            )}

          </div>

        </div>

        {/* RIGHT PANEL */}

        <div className="flex w-full items-center justify-center lg:w-1/2 px-8 py-12">

          <div className="w-full max-w-md">

            {/* Back link stays reachable on mobile, where the left panel is hidden */}
            <Link
              to="/"
              className="mb-8 inline-flex items-center gap-2 text-slate-400 hover:text-white transition lg:hidden"
            >
              <ArrowLeft size={18} />
              Back to Home
            </Link>

            <h2 className="text-5xl font-bold font-display tracking-tight">
              {title}
            </h2>

            <p className="mt-3 text-slate-400">
              {subtitle}
            </p>

            <div className="mt-10">
              {children}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
