import { Link } from "react-router-dom";
import { FileQuestion, ArrowLeft } from "lucide-react";

import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import { useAuth } from "../../context/AuthContext";
import { useSeo } from "../../hooks/useSeo";

export default function NotFound() {
  useSeo({
    title: "Page Not Found",
    description: "The page you're looking for doesn't exist.",
    path: "/404",
  });

  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Navbar />

      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-24 pt-48 text-center sm:px-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-indigo-400">
          <FileQuestion size={28} aria-hidden="true" />
        </div>

        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-400">
          404
        </p>

        <h1 className="mt-4 text-4xl font-bold font-display tracking-tight sm:text-5xl">
          Page not found
        </h1>

        <p className="mt-5 max-w-md text-lg text-slate-400">
          The page you're looking for doesn't exist or may have moved.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            to={user ? "/dashboard" : "/"}
            className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-7 py-4 font-semibold text-white shadow-lg shadow-indigo-950/30 transition-all hover:from-indigo-500 hover:to-violet-500"
          >
            <ArrowLeft size={18} />
            {user ? "Back to Dashboard" : "Back to Home"}
          </Link>

          <Link
            to="/price"
            className="flex items-center justify-center rounded-full border border-slate-700 px-7 py-4 font-semibold text-white transition hover:bg-slate-900"
          >
            View pricing
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
