import { X } from "lucide-react";
import ChangePlanForm from "./ChangePlanForm";

export default function ChangeSubscriptionModal({
  open,
  subscription,
  onClose,
  onSaved,
}) {
  if (!open || !subscription) return null;

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

        <div className="p-6">
          <ChangePlanForm
            userId={subscription.user_id}
            initialPlanId={subscription.plan_id}
            initialBillingCycle={subscription.billing_cycle || "monthly"}
            showCancel
            onCancel={onClose}
            onSaved={async () => {
              await onSaved?.();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
