import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { formatAed, formatUsd } from "../../utils/currency";
import { useAuth } from "../../context/AuthContext";
import subscriptionApi from "../../services/subscriptionApi";

export default function PricingCard({ plan, yearly = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const price = yearly
    ? Number(plan.yearly_price)
    : Number(plan.monthly_price);

  const billingLabel = yearly ? "/year" : "/month";

  const isFree = plan.slug === "free";

  async function handleSelectPlan() {
    if (!user) {
      navigate("/login");
      return;
    }

    // Enterprise has no self-serve checkout (see getPlanButton below,
    // "Contact Sales") — nothing to wire up here, same as before.
    if (plan.slug === "enterprise") {
      return;
    }

    setError("");
    setLoading(true);

    try {
      if (isFree) {
        await subscriptionApi.selectPlan(plan.id, "monthly");
        navigate("/dashboard/usage");
        return;
      }

      const interval = yearly ? "yearly" : "monthly";
      const response = await subscriptionApi.createCheckoutSession(
        plan.id,
        interval
      );

      if (response.data.url) {
        window.location.href = response.data.url;
        return;
      }

      // Existing Stripe subscriber — the backend updated the live
      // subscription in place instead of returning a checkout URL.
      if (response.data.updated) {
        navigate("/dashboard/usage");
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Something went wrong. Please try again."
      );
      setLoading(false);
    }
  }

  const formatLimit = (value) => {
    if (value >= 999999) {
      return "Unlimited";
    }

    return value?.toLocaleString() ?? "0";
  };

  const features = [
    `${formatLimit(plan.invoice_limit)} invoices`,
    `${formatLimit(plan.client_limit)} clients`,
    `${formatLimit(plan.user_limit)} user${
      plan.user_limit === 1 ? "" : "s"
    }`,
    `${formatLimit(plan.storage_limit)} MB storage`,
    `${formatLimit(plan.ocr_limit)} AI OCR documents`,
  ];

  if (plan.api_access) {
    features.push("API access");
  }

  if (plan.priority_support) {
    features.push("Priority support");
  }

  const isPopular = Boolean(plan.featured);

  return (
    <motion.div
      whileHover={{
        y: -10,
        scale: 1.02,
      }}
      className={`relative rounded-3xl border ${
        isPopular
          ? "border-blue-500 shadow-2xl shadow-blue-500/20"
          : "border-slate-800"
      } bg-slate-900 p-8`}
    >

      {/* Plan Name + Popular Badge */}

      <div className="flex items-center justify-between gap-3">

        <h3 className="text-3xl font-bold">
          {plan.name}
        </h3>

        {isPopular && (
          <span className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold">
            Most Popular
          </span>
        )}

      </div>

      {/* Description */}

      <p className="mt-3 text-slate-400">
        {getPlanDescription(plan.slug)}
      </p>

      {/* Price */}

      <div className="mt-8">

        <div className="flex items-end gap-2">

          <span className="whitespace-nowrap text-4xl font-black">
            {price === 0
              ? "Free"
              : formatAed(price)}
          </span>

          {price > 0 && (
            <span className="pb-1.5 text-slate-400">
              {billingLabel}
            </span>
          )}

        </div>

        {price > 0 && (
          <p className="mt-2 text-sm text-slate-500">
            {formatUsd(price)}
            {billingLabel} · excl. 5% VAT
          </p>
        )}

      </div>

      {/* Button */}

      <button
        onClick={handleSelectPlan}
        disabled={loading}
        className={`mt-8 flex w-full items-center justify-center gap-2 rounded-xl py-4 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
          isPopular
            ? "bg-blue-600 hover:bg-blue-700"
            : "border border-slate-700 hover:bg-slate-800"
        }`}
      >
        {loading && <Loader2 size={18} className="animate-spin" />}
        {getPlanButton(plan.slug)}
      </button>

      {error && (
        <p className="mt-3 text-center text-sm text-red-400">{error}</p>
      )}

      {/* Features */}

      <div className="mt-10 space-y-4">

        {features.map((feature) => (
          <div
            key={feature}
            className="flex items-center gap-3"
          >
            <Check
              size={18}
              className="shrink-0 text-green-400"
            />

            <span className="text-slate-300">
              {feature}
            </span>
          </div>
        ))}

      </div>

    </motion.div>
  );
}


/**
 * Marketing descriptions are UI copy,
 * not pricing/business data.
 */
function getPlanDescription(slug) {
  switch (slug) {
    case "free":
      return "Perfect for getting started with AI invoice processing.";

    case "starter":
      return "For small businesses processing invoices regularly.";

    case "business":
      return "For growing businesses that need more automation.";

    case "enterprise":
      return "For high-volume businesses and advanced workflows.";

    default:
      return "Powerful AI invoice processing for your business.";
  }
}


/**
 * Button labels are presentation only.
 */
function getPlanButton(slug) {
  switch (slug) {
    case "free":
      return "Get Started";

    case "starter":
      return "Start Starter";

    case "business":
      return "Start Business";

    case "enterprise":
      return "Contact Sales";

    default:
      return "Get Started";
  }
}