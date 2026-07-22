import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Save,
  ShieldBan,
  ShieldCheck,
  Trash2,
  KeyRound,
  BadgeCheck,
} from "lucide-react";
import adminApi from "../../services/adminApi";

const PLAN_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Growth" },
  { value: "business", label: "Business" },
  { value: "enterprise", label: "Enterprise" },
];

const COUNTRY_OPTIONS = [
  { value: "Pakistan", label: "Pakistan" },
  { value: "Saudi Arabia", label: "Saudi Arabia" },
  { value: "UAE", label: "UAE" },
];

export default function CustomerManagePanel({ customer, onUpdated }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: customer.name || "",
    email: customer.email || "",
    company_name: customer.company_name || "",
    phone: customer.phone || "",
    country: customer.country || "",
  });
  const [plan, setPlan] = useState((customer.plan || "starter").toLowerCase());
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    setForm({
      name: customer.name || "",
      email: customer.email || "",
      company_name: customer.company_name || "",
      phone: customer.phone || "",
      country: customer.country || "",
    });
    setPlan((customer.plan || "starter").toLowerCase());
  }, [customer]);

  const isActive = String(customer.status || "").toLowerCase() === "active";

  const runAction = async (key, action, successMessage) => {
    try {
      setBusy(key);
      await action();
      toast.success(successMessage);
      await onUpdated();
    } catch (error) {
      toast.error(error.response?.data?.error || "Action failed");
    } finally {
      setBusy("");
    }
  };

  const handleSaveProfile = () =>
    runAction(
      "profile",
      () => adminApi.updateCustomer(customer.id, form),
      "Customer updated successfully"
    );

  const handleChangePlan = () =>
    runAction(
      "plan",
      () => adminApi.updateCustomerPlan(customer.id, plan),
      "Plan updated successfully"
    );

  const handleToggleStatus = () =>
    runAction(
      "status",
      () =>
        adminApi.updateCustomerStatus(
          customer.id,
          isActive ? "suspended" : "active"
        ),
      isActive ? "Customer suspended" : "Customer activated"
    );

  const handleResetPassword = () => {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    runAction(
      "password",
      async () => {
        await adminApi.resetCustomerPassword(customer.id, password);
        setPassword("");
      },
      "Password reset successfully"
    );
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Soft delete ${customer.name}? They will no longer be able to log in.`
    );

    if (!confirmed) return;

    try {
      setBusy("delete");
      await adminApi.deleteCustomer(customer.id);
      toast.success("Customer deleted successfully");
      navigate("/admin/customers");
    } catch (error) {
      toast.error(error.response?.data?.error || "Delete failed");
      setBusy("");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Edit Customer
        </h2>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm text-slate-500">Full name</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-500">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-500">Company</span>
            <input
              value={form.company_name}
              onChange={(e) =>
                setForm({ ...form, company_name: e.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-500">Phone number</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+971 50 123 4567"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-500">Country</span>
            <select
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Select country</option>
              {COUNTRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={handleSaveProfile}
            disabled={busy === "profile"}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-medium text-white transition hover:bg-violet-700 disabled:opacity-60"
          >
            <Save size={18} />
            {busy === "profile" ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BadgeCheck size={20} className="text-violet-600" />
            Change Plan
          </h2>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 capitalize text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500"
            >
              {PLAN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              onClick={handleChangePlan}
              disabled={busy === "plan"}
              className="rounded-xl border border-violet-200 bg-violet-50 px-5 py-3 font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
            >
              {busy === "plan" ? "Updating..." : "Update Plan"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Account Status
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Current status:{" "}
            <span className="font-medium capitalize text-slate-800">
              {customer.status}
            </span>
          </p>

          <button
            onClick={handleToggleStatus}
            disabled={busy === "status"}
            className={`mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 font-medium text-white transition disabled:opacity-60 ${
              isActive
                ? "bg-amber-500 hover:bg-amber-600"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {isActive ? <ShieldBan size={18} /> : <ShieldCheck size={18} />}
            {busy === "status"
              ? "Updating..."
              : isActive
                ? "Suspend Customer"
                : "Activate Customer"}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <KeyRound size={20} className="text-violet-600" />
            Reset Password
          </h2>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (min 8 chars)"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500"
            />

            <button
              onClick={handleResetPassword}
              disabled={busy === "password"}
              className="rounded-xl border border-slate-200 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {busy === "password" ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-700">
            Danger Zone
          </h2>

          <p className="mt-2 text-sm text-red-600">
            Soft delete hides this customer from admin and blocks login. Data is
            kept in the database.
          </p>

          <button
            onClick={handleDelete}
            disabled={busy === "delete"}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            <Trash2 size={18} />
            {busy === "delete" ? "Deleting..." : "Soft Delete Customer"}
          </button>
        </div>
      </div>
    </div>
  );
}
