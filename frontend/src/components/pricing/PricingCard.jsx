import { motion } from "framer-motion";
import { Check } from "lucide-react";

export default function PricingCard({ plan, yearly = false }) {
  const price = yearly
    ? Number(plan.yearly_price)
    : Number(plan.monthly_price);

  const billingLabel = yearly ? "/year" : "/month";

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

      {/* Popular Badge */}

      {isPopular && (
        <div className="absolute right-6 top-6 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold">
          Most Popular
        </div>
      )}

      {/* Plan Name */}

      <h3 className="text-3xl font-bold">
        {plan.name}
      </h3>

      {/* Description */}

      <p className="mt-3 text-slate-400">
        {getPlanDescription(plan.slug)}
      </p>

      {/* Price */}

      <div className="mt-8 flex items-end gap-2">

        <span className="text-6xl font-black">
          {price === 0
            ? "Free"
            : `$${price.toLocaleString()}`}
        </span>

        {price > 0 && (
          <span className="pb-2 text-slate-400">
            {billingLabel}
          </span>
        )}

      </div>

      {/* Button */}

      <button
        className={`mt-8 w-full rounded-xl py-4 font-semibold transition ${
          isPopular
            ? "bg-blue-600 hover:bg-blue-700"
            : "border border-slate-700 hover:bg-slate-800"
        }`}
      >
        {getPlanButton(plan.slug)}
      </button>

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