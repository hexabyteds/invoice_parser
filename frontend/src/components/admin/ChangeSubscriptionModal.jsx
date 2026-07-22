import { useEffect, useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import toast from "react-hot-toast";
import adminApi from "../../services/adminApi";
import planApi from "../../services/planApi";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500";

export default function ChangeSubscriptionModal({
  open,
  subscription,
  onClose,
  onSaved,
}) {
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState("");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    setPlanId(String(subscription?.plan_id || ""));
    setBillingCycle(subscription?.billing_cycle || "monthly");

    async function loadPlans() {
      try {
        setLoadingPlans(true);
        const data = await planApi.getAll();
        setPlans((data.plans || []).filter((plan) => plan.active));
      } catch (error) {
        toast.error(error.response?.data?.error || "Unable to load plans.");
      } finally {
        setLoadingPlans(false);
      }
    }

    loadPlans();
  }, [open, subscription]);

  if (!open || !subscription) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!planId) {
      toast.error("Please select a plan.");
      return;
    }

    try {
      setSaving(true);
      await adminApi.updateCustomerPlan(
        subscription.user_id,
        Number(planId),
        billingCycle
      );
      toast.success("Subscription updated successfully.");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || "Unable to update plan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Change Plan</h2>
            <p className="text-sm text-slate-500">
              {subscription.customer_name} · {subscription.customer_email}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Plan</span>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              disabled={loadingPlans}
              className={`${inputClass} mt-1.5 capitalize`}
            >
              <option value="">Select plan</option>
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

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || loadingPlans}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-medium text-white hover:bg-violet-700 disabled:opacity-60"
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
      </div>
    </div>
  );
}
