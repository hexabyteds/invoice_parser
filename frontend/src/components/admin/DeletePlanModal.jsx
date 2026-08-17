import { useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import planApi from "../../services/planApi";

export default function DeletePlanModal({ open, plan, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

  if (!open || !plan) return null;

  const isFreePlan = plan.slug === "free";

  const handleDelete = async () => {
    if (isFreePlan) {
      toast.error("Free plan cannot be deleted.");
      return;
    }

    try {
      setDeleting(true);
      await planApi.delete(plan.id);
      toast.success("Plan deleted successfully.");
      onDeleted();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || "Unable to delete plan.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle size={22} />
        </div>

        <h2 className="mt-4 text-xl font-bold text-slate-900">
          Delete plan?
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          You are about to delete <strong>{plan.name}</strong> (
          <span className="font-mono text-xs">{plan.slug}</span>).
          {isFreePlan
            ? " The free plan is protected and cannot be removed."
            : " This action cannot be undone if no customers are using it."}
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || isFreePlan}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Trash2 size={18} />
            )}
            {deleting ? "Deleting..." : "Delete Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
