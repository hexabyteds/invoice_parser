import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/features", label: "Features" },
  { to: "/price", label: "Pricing" },
];

const contactLink = { to: "/contact", label: "Contact Us" };

const toolsLinks = [
  { to: "/invoice-generator", label: "Invoice Generator" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (toolsRef.current && !toolsRef.current.contains(e.target)) {
        setToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
              <span className="block text-lg font-bold text-white font-display tracking-tight">
                EazeeBooks
              </span>

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

            <div className="relative" ref={toolsRef}>
              <button
                type="button"
                onClick={() => setToolsOpen((open) => !open)}
                aria-haspopup="true"
                aria-expanded={toolsOpen}
                className="flex items-center gap-1 transition hover:text-white"
              >
                Tools
                <ChevronDown size={14} className={`transition-transform ${toolsOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {toolsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full mt-3 min-w-[200px] rounded-2xl border border-slate-800 bg-slate-900/95 p-2 shadow-xl backdrop-blur-xl"
                  >
                    {toolsLinks.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        onClick={() => setToolsOpen(false)}
                        className="block rounded-xl px-4 py-2.5 text-sm text-slate-200 transition hover:bg-slate-800 hover:text-white"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link to={contactLink.to} className="transition hover:text-white">
              {contactLink.label}
            </Link>
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

              <p className="px-4 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tools
              </p>
              {toolsLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl px-4 py-3 text-base text-slate-200 transition hover:bg-slate-800 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}

              <Link
                to={contactLink.to}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-4 py-3 text-base text-slate-200 transition hover:bg-slate-800 hover:text-white"
              >
                {contactLink.label}
              </Link>

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
