import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";
import adminApi from "../../services/adminApi";
import planApi from "../../services/planApi";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500";

function resolveInitialPlanId(plans, { initialPlanId, initialPlanSlug }) {
  if (initialPlanId != null && initialPlanId !== "") {
    const byId = plans.find(
      (plan) => String(plan.id) === String(initialPlanId)
    );
    if (byId) return String(byId.id);
  }

  if (initialPlanSlug) {
    const needle = String(initialPlanSlug).toLowerCase();
    const bySlug = plans.find(
      (plan) =>
        plan.slug?.toLowerCase() === needle ||
        plan.name?.toLowerCase() === needle
    );
    if (bySlug) return String(bySlug.id);
  }

  return "";
}

export default function ChangePlanForm({
  userId,
  initialPlanId,
  initialPlanSlug,
  initialBillingCycle = "monthly",
  onSaved,
  onCancel,
  showCancel = false,
}) {
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState("");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPlans() {
      try {
        setLoadingPlans(true);
        const data = await planApi.getAll();
        const activePlans = (data.plans || []).filter((plan) => plan.active);

        if (cancelled) return;

        setPlans(activePlans);
        setPlanId(
          resolveInitialPlanId(activePlans, {
            initialPlanId,
            initialPlanSlug,
          })
        );
        setBillingCycle(initialBillingCycle || "monthly");
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error.response?.data?.error || "Unable to load plans."
          );
        }
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    }

    loadPlans();

    return () => {
      cancelled = true;
    };
  }, [userId, initialPlanId, initialPlanSlug, initialBillingCycle]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!planId) {
      toast.error("Please select a plan.");
      return;
    }

    try {
      setSaving(true);
      await adminApi.updateCustomerPlan(
        userId,
        Number(planId),
        billingCycle
      );
      toast.success("Plan updated successfully.");
      await onSaved?.();
    } catch (error) {
      toast.error(error.response?.data?.error || "Unable to update plan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block">
        <span className="text-sm font-medium text-slate-600">Plan</span>
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          disabled={loadingPlans}
          className={`${inputClass} mt-1.5 capitalize`}
        >
          <option value="">
            {loadingPlans ? "Loading plans..." : "Select plan"}
          </option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — ${Number(plan.monthly_price).toFixed(2)}/mo
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-600">
          Billing cycle
        </span>
        <select
          value={billingCycle}
          onChange={(e) => setBillingCycle(e.target.value)}
          className={`${inputClass} mt-1.5 capitalize`}
        >
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </label>

      <div
        className={`flex gap-3 ${
          showCancel ? "justify-end border-t border-slate-200 pt-4" : ""
        }`}
      >
        {showCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          disabled={saving || loadingPlans}
          className={
            showCancel
              ? "inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-medium text-white hover:bg-violet-700 disabled:opacity-60"
              : "inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-5 py-3 font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
          }
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Save size={18} />
          )}
          {saving ? "Updating..." : "Update Plan"}
        </button>
      </div>
    </form>
  );
}
