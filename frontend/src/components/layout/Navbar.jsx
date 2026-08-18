import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/features", label: "Features" },
  { to: "/price", label: "Pricing" },
  { to: "/contact", label: "Contact Us" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 w-full z-50"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mt-5 flex h-16 items-center justify-between rounded-full border border-slate-800 bg-slate-900/70 px-5 sm:px-8 backdrop-blur-xl">

          <Link to="/" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white shadow-lg shadow-indigo-950/40">
              EB
            </div>

            <div>
              <h1 className="text-lg font-bold text-white font-display tracking-tight">
                EazeeBooks
              </h1>

              <p className="text-xs text-slate-400">
                AI Accounting Platform
              </p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-10 text-sm text-slate-300">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className="transition hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">

            <Link
              to="/login"
              className="text-slate-300 transition hover:text-white"
            >
              Login
            </Link>

            <Link
              to="/register"
              className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/30 transition hover:from-indigo-500 hover:to-violet-500"
            >
              Start Free
            </Link>

          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-300 transition hover:bg-slate-800 hover:text-white md:hidden"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-3 flex flex-col gap-1 rounded-3xl border border-slate-800 bg-slate-900/95 p-4 backdrop-blur-xl md:hidden"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl px-4 py-3 text-base text-slate-200 transition hover:bg-slate-800 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}

              <div className="my-2 h-px bg-slate-800" />

              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-4 py-3 text-base text-slate-200 transition hover:bg-slate-800 hover:text-white"
              >
                Login
              </Link>

              <Link
                to="/register"
                onClick={() => setMobileOpen(false)}
                className="mt-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-center text-base font-semibold text-white transition hover:from-indigo-500 hover:to-violet-500"
              >
                Start Free
              </Link>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}