import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";

import { getPublicPlans } from "../../services/api";
import { formatAed } from "../../utils/currency";

export default function PricingTeaser() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getPublicPlans()
      .then((response) => {
        if (!cancelled) setPlans(response.data.plans || []);
      })
      .catch(() => {
        if (!cancelled) setPlans([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-6 py-24 sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
          Pricing
        </p>
        <h2 className="mt-4 text-4xl font-bold text-white sm:text-5xl">
          Simple pricing, no per-user tax.
        </h2>
        <p className="mt-5 text-lg text-slate-400">
          Prices shown in AED, excluding 5% UAE VAT.
        </p>
      </div>

      {loading && (
        <p className="mt-14 text-center text-slate-500">Loading pricing…</p>
      )}

      {!loading && plans.length > 0 && (
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const price = Number(plan.monthly_price);
            const isPopular = Boolean(plan.featured);

            return (
              <div
                key={plan.id}
                className={`rounded-3xl border p-6 ${
                  isPopular
                    ? "border-blue-500 bg-slate-900 shadow-xl shadow-blue-500/10"
                    : "border-slate-800 bg-slate-900/60"
                }`}
              >
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>

                <p className="mt-3 text-3xl font-black text-white">
                  {price === 0 ? "Free" : formatAed(price)}
                  {price > 0 && (
                    <span className="text-base font-normal text-slate-400">
                      /mo
                    </span>
                  )}
                </p>

                <p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                  <Check size={16} className="shrink-0 text-green-400" />
                  {(plan.invoice_limit >= 999999
                    ? "Unlimited"
                    : plan.invoice_limit?.toLocaleString()) || "0"}{" "}
                  invoices / month
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-12 text-center">
        <Link
          to="/price"
          className="inline-flex items-center justify-center rounded-full border border-slate-700 px-7 py-4 font-semibold text-white transition hover:bg-slate-900"
        >
          Compare all plans &amp; features
        </Link>
      </div>
    </section>
  );
}
