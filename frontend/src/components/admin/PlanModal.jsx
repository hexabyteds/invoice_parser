import { useEffect, useState } from "react";
import { X, Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";
import planApi from "../../services/planApi";

const EMPTY_FORM = {
  name: "",
  slug: "",
  monthly_price: "",
  yearly_price: "",
  invoice_limit: "",
  client_limit: "",
  user_limit: "",
  storage_limit: "",
  ocr_limit: "",
  api_access: false,
  priority_support: false,
  active: true,
  featured: false,
  stripe_product_id: "",
  stripe_price_id_monthly: "",
  stripe_price_id_yearly: "",
};

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function toFormValues(plan) {
  if (!plan) return { ...EMPTY_FORM };

  return {
    name: plan.name || "",
    slug: plan.slug || "",
    monthly_price: plan.monthly_price ?? "",
    yearly_price: plan.yearly_price ?? "",
    invoice_limit: plan.invoice_limit ?? "",
    client_limit: plan.client_limit ?? "",
    user_limit: plan.user_limit ?? "",
    storage_limit: plan.storage_limit ?? "",
    ocr_limit: plan.ocr_limit ?? "",
    api_access: Boolean(plan.api_access),
    priority_support: Boolean(plan.priority_support),
    active: Boolean(plan.active),
    featured: Boolean(plan.featured),
    stripe_product_id: plan.stripe_product_id || "",
    stripe_price_id_monthly: plan.stripe_price_id_monthly || "",
    stripe_price_id_yearly: plan.stripe_price_id_yearly || "",
  };
}

function toPayload(form) {
  return {
    name: form.name.trim(),
    slug: form.slug.trim().toLowerCase(),
    monthly_price: Number(form.monthly_price) || 0,
    yearly_price: Number(form.yearly_price) || 0,
    invoice_limit: Number(form.invoice_limit) || 0,
    client_limit: Number(form.client_limit) || 0,
    user_limit: Number(form.user_limit) || 0,
    storage_limit: Number(form.storage_limit) || 0,
    ocr_limit: Number(form.ocr_limit) || 0,
    api_access: form.api_access ? 1 : 0,
    priority_support: form.priority_support ? 1 : 0,
    active: form.active ? 1 : 0,
    featured: form.featured ? 1 : 0,
    stripe_product_id: form.stripe_product_id.trim() || null,
    stripe_price_id_monthly: form.stripe_price_id_monthly.trim() || null,
    stripe_price_id_yearly: form.stripe_price_id_yearly.trim() || null,
  };
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500";

export default function PlanModal({ open, plan, onClose, onSaved }) {
  const isEdit = Boolean(plan?.id);
  const [form, setForm] = useState(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    setForm(toFormValues(plan));
    setSlugTouched(Boolean(plan?.slug));
  }, [open, plan]);

  if (!open) return null;

  const update = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "name" && !slugTouched && !isEdit) {
        next.slug = slugify(value);
      }

      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      toast.error("Plan name is required.");
      return;
    }

    if (!form.slug.trim()) {
      toast.error("Plan slug is required.");
      return;
    }

    try {
      setSaving(true);
      const payload = toPayload(form);

      if (isEdit) {
        await planApi.update(plan.id, payload);
        toast.success("Plan updated successfully.");
      } else {
        await planApi.create(payload);
        toast.success("Plan created successfully.");
      }

      onSaved();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || "Unable to save plan.");
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

      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {isEdit ? "Edit Plan" : "Add New Plan"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit
                ? "Update pricing, limits, and features."
                : "Create a new subscription plan."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 p-6">
          <section className="grid gap-4 md:grid-cols-2">
            <h3 className="md:col-span-2 text-sm font-semibold uppercase tracking-wide text-indigo-600">
              Basic Info
            </h3>

            <Field label="Plan name">
              <input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Growth"
                className={inputClass}
              />
            </Field>

            <Field label="Slug" hint="Used internally. Example: growth">
              <input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  update("slug", slugify(e.target.value));
                }}
                placeholder="growth"
                disabled={plan?.slug === "free"}
                className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-500`}
              />
            </Field>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <h3 className="md:col-span-2 text-sm font-semibold uppercase tracking-wide text-indigo-600">
              Pricing
            </h3>

            <Field label="Monthly price ($)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.monthly_price}
                onChange={(e) => update("monthly_price", e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Yearly price ($)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.yearly_price}
                onChange={(e) => update("yearly_price", e.target.value)}
                className={inputClass}
              />
            </Field>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <h3 className="sm:col-span-2 lg:col-span-3 text-sm font-semibold uppercase tracking-wide text-indigo-600">
              Limits
            </h3>

            <Field label="Invoice limit">
              <input
                type="number"
                min="0"
                value={form.invoice_limit}
                onChange={(e) => update("invoice_limit", e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Client limit">
              <input
                type="number"
                min="0"
                value={form.client_limit}
                onChange={(e) => update("client_limit", e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="User limit">
              <input
                type="number"
                min="0"
                value={form.user_limit}
                onChange={(e) => update("user_limit", e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Storage limit (MB)">
              <input
                type="number"
                min="0"
                value={form.storage_limit}
                onChange={(e) => update("storage_limit", e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="OCR limit">
              <input
                type="number"
                min="0"
                value={form.ocr_limit}
                onChange={(e) => update("ocr_limit", e.target.value)}
                className={inputClass}
              />
            </Field>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <h3 className="md:col-span-2 text-sm font-semibold uppercase tracking-wide text-indigo-600">
              Stripe Billing
            </h3>

            <p className="md:col-span-2 -mt-2 text-xs text-slate-400">
              Optional. Leave blank until Stripe Prices exist for this plan —
              customers can&apos;t check out for this plan/interval until set.
            </p>

            <Field label="Stripe Product ID" hint="e.g. prod_...">
              <input
                value={form.stripe_product_id}
                onChange={(e) => update("stripe_product_id", e.target.value)}
                placeholder="prod_..."
                className={inputClass}
              />
            </Field>

            <div className="hidden md:block" />

            <Field label="Stripe Monthly Price ID" hint="e.g. price_...">
              <input
                value={form.stripe_price_id_monthly}
                onChange={(e) =>
                  update("stripe_price_id_monthly", e.target.value)
                }
                placeholder="price_..."
                className={inputClass}
              />
            </Field>

            <Field label="Stripe Yearly Price ID" hint="e.g. price_...">
              <input
                value={form.stripe_price_id_yearly}
                onChange={(e) =>
                  update("stripe_price_id_yearly", e.target.value)
                }
                placeholder="price_..."
                className={inputClass}
              />
            </Field>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <h3 className="sm:col-span-2 text-sm font-semibold uppercase tracking-wide text-indigo-600">
              Features & Visibility
            </h3>

            {[
              { key: "api_access", label: "API access" },
              { key: "priority_support", label: "Priority support" },
              { key: "active", label: "Active plan" },
              { key: "featured", label: "Featured on pricing page" },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={form[item.key]}
                  onChange={(e) => update(item.key, e.target.checked)}
                  disabled={item.key === "active" && plan?.slug === "free"}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700">
                  {item.label}
                </span>
              </label>
            ))}
          </section>

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
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {saving ? "Saving..." : isEdit ? "Update Plan" : "Create Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
