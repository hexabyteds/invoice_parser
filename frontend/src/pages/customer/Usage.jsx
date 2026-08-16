import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Sparkles, ArrowUpRight, CreditCard } from "lucide-react";
import { getUsage } from "../../services/usageApi";
import UsageCard from "../../components/usage/UsageCard";

export default function Usage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadUsage();
  }, []);

  async function loadUsage() {
    try {
      setLoading(true);
      setError("");
      const response = await getUsage();
      setUsage(response.usage);
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to load usage."
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
        <p className="mt-4 font-medium text-slate-700">Loading usage...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
        {error}
      </div>
    );
  }

  const metrics = [
    {
      title: "Invoices",
      ...usage.usage.invoices,
    },
    {
      title: "Clients",
      ...usage.usage.clients,
    },
    {
      title: "OCR Pages",
      ...usage.usage.ocr,
    },
    {
      title: "Storage",
      ...usage.usage.storage,
    },
    {
      title: "Team Members",
      ...usage.usage.team,
    },
  ];
  

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Usage</h1>
        <p className="mt-2 text-slate-500">
          Track your plan limits and remaining capacity.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-6 shadow-lg sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-indigo-100">
              <Sparkles size={16} />
              <span className="text-sm font-medium">Current Subscription</span>
            </div>

            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              {usage.plan.name}
            </h2>

            <span className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              {usage.plan.slug}
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={() => navigate("/dashboard/billing")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25"
            >
              <CreditCard size={16} />
              Manage Billing
            </button>

            <Link
              to="/price"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
            >
              Upgrade Plan
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <UsageCard
            key={metric.title}
            title={metric.title}
            used={metric.used}
            limit={metric.limit}
            remaining={metric.remaining}
          />
        ))}
      </div>
    </div>
  );
}
