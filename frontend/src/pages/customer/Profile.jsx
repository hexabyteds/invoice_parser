import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { User, Building2, Mail, CreditCard } from "lucide-react";

import authApi from "../../services/authApi";
import subscriptionApi from "../../services/subscriptionApi";
import planApi from "../../services/planApi";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useAuth } from "../../context/AuthContext";

export default function Profile() {
  const { updateUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ name: "", company_name: "" });
  const [saving, setSaving] = useState(false);

  const [switchingPlanId, setSwitchingPlanId] = useState(null);
  const [changingPlan, setChangingPlan] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);

      const [meRes, subRes, plansRes] = await Promise.all([
        authApi.me(),
        subscriptionApi.getCurrent(),
        planApi.getAll(),
      ]);

      setProfile(meRes.data.user);
      setForm({
        name: meRes.data.user.name || "",
        company_name: meRes.data.user.company_name || "",
      });
      setSubscription(subRes.data.subscription);
      // /api/plans already only returns active plans.
      setPlans(plansRes.plans || []);
    } catch (err) {
      toast.error("Unable to load profile.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }

    try {
      setSaving(true);
      const res = await authApi.updateProfile(form);
      setProfile(res.data.user);
      updateUser(res.data.user);
      toast.success("Profile updated successfully.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmSwitchPlan() {
    if (!switchingPlanId) return;

    try {
      setChangingPlan(true);
      await subscriptionApi.selectPlan(switchingPlanId);
      toast.success("Plan updated successfully.");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Unable to change plan.");
    } finally {
      setChangingPlan(false);
      setSwitchingPlanId(null);
    }
  }

  async function confirmCancel() {
    try {
      setCancelling(true);
      await subscriptionApi.cancel();
      toast.success("Subscription cancelled — you're back on the Free plan.");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Unable to cancel subscription.");
    } finally {
      setCancelling(false);
      setCancelOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border p-10 text-center text-slate-500">
        Loading profile...
      </div>
    );
  }

  const currentPlanSlug = subscription?.slug;
  const otherPlans = plans.filter((p) => p.slug !== currentPlanSlug);
  const switchingPlan = plans.find((p) => p.id === switchingPlanId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-black">My Profile</h1>
        <p className="text-slate-500 mt-2">
          Manage your account details and subscription plan.
        </p>
      </div>

      {/* Profile Information */}
      <div className="bg-white rounded-3xl shadow border p-8">
        <h2 className="text-xl font-semibold text-black mb-6">
          Profile Information
        </h2>

        <form onSubmit={handleSaveProfile} className="grid md:grid-cols-2 gap-6 max-w-2xl">
          <div>
            <label className="text-sm font-semibold text-black flex items-center gap-2 mb-2">
              <User size={16} /> Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-3 text-black outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-black flex items-center gap-2 mb-2">
              <Building2 size={16} /> Company Name
            </label>
            <input
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-3 text-black outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-semibold text-slate-500 flex items-center gap-2 mb-2">
              <Mail size={16} /> Email
            </label>
            <input
              value={profile?.email || ""}
              disabled
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-500 outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <button
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-60 transition"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      {/* Current Plan */}
      <div className="bg-white rounded-3xl shadow border p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-black">Current Plan</h2>
          {subscription && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 capitalize">
              {subscription.status}
            </span>
          )}
        </div>

        {subscription ? (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <PlanStat icon={<CreditCard size={16} />} label="Plan" value={subscription.name} />
              <PlanStat label="Billing Cycle" value={subscription.billing_cycle || "-"} />
              <PlanStat
                label="Price"
                value={`AED ${Number(subscription.price || 0).toFixed(2)}`}
              />
              <PlanStat
                label="Next Billing"
                value={
                  subscription.next_billing
                    ? new Date(subscription.next_billing).toLocaleDateString()
                    : "-"
                }
              />
            </div>

            {subscription.slug !== "free" && (
              <button
                onClick={() => setCancelOpen(true)}
                className="mt-6 px-5 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-medium transition"
              >
                Cancel Plan
              </button>
            )}
          </>
        ) : (
          <p className="text-slate-500">No active subscription found.</p>
        )}
      </div>

      {/* Switch Plan */}
      {otherPlans.length > 0 && (
        <div className="bg-white rounded-3xl shadow border p-8">
          <h2 className="text-xl font-semibold text-black mb-6">Switch Plan</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {otherPlans.map((plan) => (
              <div key={plan.id} className="border rounded-2xl p-6 flex flex-col">
                <h3 className="font-bold text-lg text-black">{plan.name}</h3>
                <p className="text-2xl font-bold text-black mt-2">
                  AED {Number(plan.monthly_price).toFixed(2)}
                  <span className="text-sm font-normal text-slate-500">/mo</span>
                </p>

                <ul className="mt-4 space-y-1 text-sm text-slate-600 flex-1">
                  <li>{plan.invoice_limit} invoices/mo</li>
                  <li>{plan.client_limit} clients</li>
                  <li>{plan.ocr_limit} OCR pages</li>
                </ul>

                <button
                  onClick={() => setSwitchingPlanId(plan.id)}
                  className="mt-5 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition"
                >
                  Switch to {plan.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(switchingPlanId)}
        title="Switch plan?"
        message={
          switchingPlan
            ? `Switch to the ${switchingPlan.name} plan? Your current plan will end immediately.`
            : ""
        }
        confirmLabel="Switch Plan"
        danger={false}
        loading={changingPlan}
        onConfirm={confirmSwitchPlan}
        onCancel={() => setSwitchingPlanId(null)}
      />

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel your subscription?"
        message="You'll be moved back to the Free plan immediately. This cannot be undone."
        confirmLabel="Cancel Plan"
        loading={cancelling}
        onConfirm={confirmCancel}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  );
}

function PlanStat({ label, value, icon }) {
  return (
    <div className="p-4 rounded-xl bg-slate-50 border">
      <p className="text-xs text-slate-500 flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-bold text-black capitalize">{value}</p>
    </div>
  );
}
