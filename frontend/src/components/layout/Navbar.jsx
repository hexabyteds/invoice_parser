import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 w-full z-50"
    >
      <div className="mx-auto max-w-7xl px-8">
        <div className="mt-5 flex h-16 items-center justify-between rounded-full border border-slate-800 bg-slate-900/70 px-8 backdrop-blur-xl">

          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 font-bold text-white">
              IP
            </div>

            <div>
              <h1 className="text-lg font-bold text-white">
                EazeeBooks
              </h1>

              <p className="text-xs text-slate-400">
                AI Accounting Platform
              </p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-10 text-sm text-slate-300">
            <a href="#">Features</a>
            <a href="#">Solutions</a>
            <Link to="/price" className="transition hover:text-white">
              Pricing
            </Link>
            <a href="#">Resources</a>
          </nav>

          <div className="flex items-center gap-4">

            <Link
              to="/login"
              className="text-slate-300 transition hover:text-white"
            >
              Login
            </Link>

            <Link
              to="/register"
              className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold transition hover:bg-blue-500"
            >
              Start Free
            </Link>

          </div>

        </div>
      </div>
    </motion.header>
  );
}