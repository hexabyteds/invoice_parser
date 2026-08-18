import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { getPublicPlans } from "../../services/api";

import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import BillingToggle from "../../components/pricing/BillingToggle";
import PricingCard from "../../components/pricing/PricingCard";
import ComparisonTable from "../../components/pricing/ComparisonTable";
import { useSeo } from "../../hooks/useSeo";
import { useAuth } from "../../context/AuthContext";
import CustomerLayout from "../../layouts/CustomerLayout";

export default function Pricing() {
  useSeo({
    title: "Pricing",
    description:
      "Simple, transparent pricing for AI invoice processing — priced in AED, no per-user fees. Compare Free, Starter, Business, and Enterprise plans.",
    path: "/price",
  });

  const { user } = useAuth();

  const [yearly, setYearly] = useState(false);

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await getPublicPlans();

        setPlans(response.data.plans || []);
      } catch (err) {
        console.error("Failed to load plans:", err);

        setError("Unable to load pricing plans.");
      } finally {
        setLoading(false);
      }
    };

    loadPlans();
  }, []);

  // Logged-in users reach this page via "Upgrade Plan" / "Manage Billing"
  // from inside the dashboard — keep them inside the dashboard shell
  // (sidebar/topbar) instead of dropping them onto the marketing site.
  const pricingContent = (
    <div className={user ? "rounded-3xl bg-[#020617] text-white" : "min-h-screen bg-[#020617] text-white"}>

      {!user && <Navbar />}

      {/* Hero */}

      <section className={`mx-auto max-w-7xl px-6 pb-16 ${user ? "pt-16" : "pt-36"}`}>

        <motion.h1
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          className="text-center text-5xl sm:text-6xl font-extrabold font-display tracking-tight"
        >
          Simple pricing,
          <br />

          <span className="bg-gradient-to-r from-indigo-400 to-violet-500 bg-clip-text text-transparent">
            built for every business.
          </span>
        </motion.h1>

        <motion.p
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          transition={{
            delay: 0.2
          }}
          className="mx-auto mt-8 max-w-3xl text-center text-xl leading-9 text-slate-400"
        >
          Process invoices using AI,
          automate bookkeeping,
          export to QuickBooks or Zoho Books,
          and grow your business without paying per user.
        </motion.p>

        <div className="mt-14 flex flex-col items-center gap-3">

          <BillingToggle
            yearly={yearly}
            setYearly={setYearly}
          />

          <p className="text-sm text-slate-500">
            Prices shown in AED, excluding 5% UAE VAT.
          </p>

        </div>

      </section>

      {/* Pricing Cards */}

      <section className="mx-auto grid max-w-7xl gap-8 px-6 pb-24 lg:grid-cols-4">

        {loading && (
          <div className="col-span-full py-20 text-center text-slate-400">
            Loading pricing plans...
          </div>
        )}

        {!loading && error && (
          <div className="col-span-full py-20 text-center text-red-400">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          plans.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              yearly={yearly}
            />
          ))}

      </section>

      <ComparisonTable />

      {!user && <Footer />}

    </div>
  );

  if (user) {
    return <CustomerLayout>{pricingContent}</CustomerLayout>;
  }

  return pricingContent;
}