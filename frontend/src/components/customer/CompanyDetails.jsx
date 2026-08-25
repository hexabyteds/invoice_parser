import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Building2, Save } from "lucide-react";
import companyApi from "../../services/companyApi";
import { useAuth } from "../../context/AuthContext";

// The active company's own business details — address/phone/email/TRN.
// Every member can view them (useful context when working across several
// companies); only the OWNER can edit (enforced server-side too, see
// companyService.updateCompanyDetails).
export default function CompanyDetails() {
  const { currentCompany } = useAuth();
  const isOwner = currentCompany?.role === "OWNER";

  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "", trn: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const res = await companyApi.getCurrentCompany();
      const c = res.data.company;
      setForm({
        name: c.name || "",
        address: c.address || "",
        phone: c.phone || "",
        email: c.email || "",
        trn: c.trn || "",
      });
    } catch (err) {
      toast.error(err.response?.data?.error || "Unable to load company details.");
    } finally {
      setLoading(false);
    }
  }

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      await companyApi.updateCurrentCompany(form);
      toast.success("Company details saved.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't save company details.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow">
        <div className="flex items-center gap-2 border-b border-slate-200 px-8 py-6">
          <Building2 size={20} className="text-blue-600" />
          <h2 className="text-xl font-semibold text-black">Company Details</h2>
        </div>
        <p className="px-8 py-10 text-center text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow">
      <div className="flex items-center gap-2 border-b border-slate-200 px-8 py-6">
        <Building2 size={20} className="text-blue-600" />
        <h2 className="text-xl font-semibold text-black">Company Details</h2>
      </div>

      <form onSubmit={save} className="space-y-4 px-8 py-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Company name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            disabled={!isOwner}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Address</label>
          <textarea
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            disabled={!isOwner}
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Phone number</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              disabled={!isOwner}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              disabled={!isOwner}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">VAT / TRN number</label>
          <input
            type="text"
            value={form.trn}
            onChange={(e) => update("trn", e.target.value)}
            disabled={!isOwner}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        {isOwner && (
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            <Save size={16} />
            Save Changes
          </button>
        )}
      </form>
    </div>
  );
}
