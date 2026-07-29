import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { getPublicPlans } from "../../services/api";

import Navbar from "../../components/layout/Navbar";
import BillingToggle from "../../components/pricing/BillingToggle";
import PricingCard from "../../components/pricing/PricingCard";
import ComparisonTable from "../../components/pricing/ComparisonTable";

export default function Pricing() {
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

  return (
    <div className="min-h-screen bg-[#020617] text-white">

      <Navbar />

      {/* Hero */}

      <section className="mx-auto max-w-7xl px-6 pt-36 pb-16">

        <motion.h1
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          className="text-center text-6xl font-black"
        >
          Simple pricing,
          <br />

          <span className="bg-gradient-to-r from-blue-400 to-violet-500 bg-clip-text text-transparent">
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
          export to QuickBooks,
          Zoho,
          Xero and grow your business without paying per user.
        </motion.p>

        <div className="mt-14 flex justify-center">

          <BillingToggle
            yearly={yearly}
            setYearly={setYearly}
          />

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

    </div>
  );
}