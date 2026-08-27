import { useState } from "react";
import { Briefcase, Building2, Check, X, Plus } from "lucide-react";
import toast from "react-hot-toast";
import companyApi from "../../services/companyApi";
import { useAuth } from "../../context/AuthContext";

// Shown in place of the dashboard for a Freelancer with no accepted
// company yet — either brand new (no invitations at all) or with
// invitations still pending a response. A Freelancer can either wait to be
// invited by an existing Company, or start their own workspace outright
// (createCompany below) — e.g. a bookkeeper setting up a client's company
// shell before that client ever needs a login of their own.
export default function NoCompanyState() {
  const { invitations, refreshUser, switchCompany } = useAuth();
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "", trn: "" });
  const [creating, setCreating] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function createCompany(e) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setCreating(true);
    try {
      const res = await companyApi.createCompany(form);
      toast.success(`${form.name.trim()} created.`);
      await refreshUser();
      switchCompany(res.data.companyId);
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't create company.");
      setCreating(false);
    }
  }

  async function accept(inv) {
    setBusyId(inv.id);
    try {
      await companyApi.acceptInvitation(inv.id);
      toast.success(`You're now part of ${inv.companyName}.`);
      await refreshUser();
      switchCompany(inv.companyId);
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't accept invitation.");
      setBusyId(null);
    }
  }

  async function decline(inv) {
    setBusyId(inv.id);
    try {
      await companyApi.declineInvitation(inv.id);
      toast.success("Invitation declined.");
      await refreshUser();
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't decline invitation.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <Briefcase size={28} />
      </div>

      <h1 className="mt-6 text-2xl font-bold text-slate-900">
        {invitations.length ? "You have pending invitations" : "Start or join a company"}
      </h1>

      <p className="mt-2 text-slate-500">
        As a Freelancer, you manage companies — either your own or ones that
        invite you to work in their workspace.
      </p>

      {invitations.length > 0 && (
        <div className="mt-8 space-y-3 text-left">
          {invitations.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Building2 size={18} />
                </div>
                <div>
                  <p className="font-medium text-slate-900">{inv.companyName}</p>
                  <p className="text-xs text-slate-400">Invited to join as Freelancer</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => accept(inv)}
                  disabled={busyId === inv.id}
                  className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  <Check size={16} />
                  Accept
                </button>
                <button
                  onClick={() => decline(inv)}
                  disabled={busyId === inv.id}
                  className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <X size={16} />
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
        <p className="mb-1 text-sm font-medium text-slate-700">Create your own company</p>
        <p className="mb-4 text-xs text-slate-400">Only the company name is required — the rest can be filled in later from Settings.</p>
        <form onSubmit={createCompany} className="space-y-3">
          <input
            type="text"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Company name *"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500"
          />
          <textarea
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="Address"
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="Phone number"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500"
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="Email"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500"
            />
          </div>
          <input
            type="text"
            value={form.trn}
            onChange={(e) => update("trn", e.target.value)}
            placeholder="VAT / TRN number"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={creating || !form.name.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            <Plus size={16} />
            Create Company
          </button>
        </form>
      </div>
    </div>
  );
}
