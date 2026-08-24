import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ShieldCheck } from "lucide-react";

import authApi from "../../services/authApi";
import TeamAccess from "../../components/customer/TeamAccess";
import { useAuth } from "../../context/AuthContext";

export default function Settings() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, currentCompany } = useAuth();

  // Team management is OWNER-only server-side (requireCompanyPermission's
  // OWNER bypass) — a Company account is always the owner of its own
  // workspace, a Freelancer never owns the company they're currently
  // acting in, so this section simply doesn't apply to them.
  const canManageTeam = user?.account_type === "COMPANY" && currentCompany?.role === "OWNER";

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const res = await authApi.loginHistory();
      setHistory(res.data.history || []);
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Unable to load login history."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-black">Settings</h1>
        <p className="text-slate-500 mt-2">
          Manage your account security and activity.
        </p>
      </div>

      {canManageTeam && <TeamAccess />}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow">
        <div className="flex items-center gap-2 border-b border-slate-200 px-8 py-6">
          <ShieldCheck size={20} className="text-blue-600" />
          <h2 className="text-xl font-semibold text-black">Login History</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-8 py-4 font-medium">Date &amp; Time</th>
                <th className="px-8 py-4 font-medium">Device</th>
                <th className="px-8 py-4 font-medium">Browser</th>
                <th className="px-8 py-4 font-medium">IP Address</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-8 py-10 text-center text-slate-500">
                    Loading login history...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-10 text-center text-slate-500">
                    No login activity recorded yet.
                  </td>
                </tr>
              ) : (
                history.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100">
                    <td className="px-8 py-4 text-slate-700">
                      {entry.login_time
                        ? new Date(entry.login_time).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-8 py-4 text-slate-700">
                      {entry.device || "—"}
                    </td>
                    <td className="px-8 py-4 text-slate-700">
                      {entry.browser || "—"}
                    </td>
                    <td className="px-8 py-4 text-slate-700">
                      {entry.ip_address || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
