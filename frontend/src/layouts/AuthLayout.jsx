import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, FileText, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-white">

      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#2563eb30,transparent_35%),radial-gradient(circle_at_bottom_right,#7c3aed25,transparent_40%)]" />

      <div className="relative flex min-h-screen">

        {/* LEFT PANEL */}

        <div className="hidden lg:flex w-1/2 border-r border-slate-800">

          <div className="flex w-full flex-col justify-between px-16 py-14">

            {/* Header */}

            <div>

              <Link
                to="/"
                className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition"
              >
                <ArrowLeft size={18} />
                Back to Home
              </Link>

              <div className="mt-12 flex items-center gap-4">

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
                Automate invoice extraction,
                AI validation,
                approvals,
                financing,
                analytics,
                and exports from one intelligent platform.
              </p>

            </div>

            {/* Stats */}

            <div className="grid grid-cols-3 gap-5 mt-10">

              <motion.div
                whileHover={{ y: -5 }}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
              >
                <BarChart3 className="text-indigo-400" />
                <p className="mt-5 text-sm text-slate-400">
                  AI Accuracy
                </p>
                <h3 className="mt-2 text-3xl font-bold">
                  99.8%
                </h3>
              </motion.div>

              <motion.div
                whileHover={{ y: -5 }}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
              >
                <FileText className="text-violet-400" aria-hidden="true" />
                <p className="mt-5 text-sm text-slate-400">
                  Invoices
                </p>
                <h3 className="mt-2 text-3xl font-bold">
                  1,284
                </h3>
              </motion.div>

              <motion.div
                whileHover={{ y: -5 }}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
              >
                <ShieldCheck className="text-green-400" />
                <p className="mt-5 text-sm text-slate-400">
                  Secure
                </p>
                <h3 className="mt-2 text-3xl font-bold">
                  100%
                </h3>
              </motion.div>

            </div>

            {/* Revenue Chart */}

            <div className="mt-10 rounded-3xl border border-slate-800 bg-slate-900 p-8">

              <div className="flex justify-between">

                <div>

                  <p className="text-slate-400">
                    Monthly Revenue
                  </p>

                  <h3 className="mt-2 text-4xl font-bold">
                    $245,600
                  </h3>

                </div>

                <span className="rounded-full bg-green-500/10 px-4 py-2 text-green-400">
                  +18.2%
                </span>

              </div>

              <div className="mt-8 flex h-56 items-end justify-between gap-3">

                {[35,55,45,80,60,90,70,110,85,130,100,150].map((h,i)=>(
                  <motion.div
                    key={i}
                    initial={{height:0}}
                    animate={{height:h}}
                    transition={{delay:i*0.05}}
                    className="w-full rounded-t-xl bg-gradient-to-t from-indigo-600 to-violet-500"
                  />
                ))}

              </div>

            </div>

            {/* Recent Activity */}

            <div className="mt-10 rounded-3xl border border-slate-800 bg-slate-900 p-8">

              <h3 className="text-xl font-semibold">
                Recent Invoice Activity
              </h3>

              {[
                ["INV-1024","Approved","2 min ago"],
                ["INV-1025","AI Processing","6 min ago"],
                ["INV-1026","Paid","15 min ago"],
              ].map((item,index)=>(
                <div
                  key={index}
                  className="mt-5 flex items-center justify-between border-b border-slate-800 pb-4"
                >
                  <div>

                    <h4 className="font-medium">
                      {item[0]}
                    </h4>

                    <p className="text-sm text-slate-400">
                      {item[1]}
                    </p>

                  </div>

                  <span className="text-sm text-slate-500">
                    {item[2]}
                  </span>

                </div>
              ))}

            </div>

          </div>

        </div>

        {/* RIGHT PANEL */}

        <div className="flex w-full items-center justify-center lg:w-1/2 px-8 py-12">

          <div className="w-full max-w-md">

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