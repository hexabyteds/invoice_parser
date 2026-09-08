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
import ChangePlanForm from "./ChangePlanForm";
import { COUNTRIES, getCountryByName } from "../../constants/countries";

export default function CustomerManagePanel({ customer, onUpdated }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: customer.name || "",
    email: customer.email || "",
    company_name: customer.company_name || "",
    country: customer.country || "",
    mobile_number: customer.mobile_number || "",
  });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    setForm({
      name: customer.name || "",
      email: customer.email || "",
      company_name: customer.company_name || "",
      country: customer.country || "",
      mobile_number: customer.mobile_number || "",
    });
  }, [customer]);

  const selectedCountry = getCountryByName(form.country);

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
      () =>
        adminApi.updateCustomer(customer.id, {
          name: form.name,
          email: form.email,
          company_name: form.company_name,
          country: form.country,
          country_code: selectedCountry?.dialCode || "",
          mobile_number: form.mobile_number,
        }),
      "Customer updated successfully"
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
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-500">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-500">Company</span>
            <input
              value={form.company_name}
              onChange={(e) =>
                setForm({ ...form, company_name: e.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-500">Country</span>
            <select
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-slate-500">Phone number</span>
            <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500">
              <span className="pl-4 pr-1 text-slate-500">
                {selectedCountry?.dialCode || "+--"}
              </span>
              <input
                type="tel"
                value={form.mobile_number}
                onChange={(e) =>
                  setForm({ ...form, mobile_number: e.target.value })
                }
                placeholder="50 123 4567"
                className="w-full rounded-xl px-2 py-3 text-slate-900 placeholder:text-slate-400 outline-none"
              />
            </div>
          </label>

          <button
            onClick={handleSaveProfile}
            disabled={busy === "profile"}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            <Save size={18} />
            {busy === "profile" ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BadgeCheck size={20} className="text-indigo-600" />
            Change Plan
          </h2>

          <div className="mt-4">
            <ChangePlanForm
              userId={customer.id}
              initialPlanSlug={customer.plan}
              onSaved={onUpdated}
            />
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
            <KeyRound size={20} className="text-indigo-600" />
            Reset Password
          </h2>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (min 8 chars)"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
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
