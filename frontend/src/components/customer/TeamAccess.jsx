import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Users, UserPlus, Trash2, Pause, Play } from "lucide-react";
import companyApi from "../../services/companyApi";

// Every module listed here has live server-side enforcement via
// requireCompanyPermission (see routes/customerRoutes.js, supplierRoutes.js,
// app-backend.js's inline invoice routes) — offering a checkbox for a
// module that doesn't affect anything yet would be dishonest UI, so this
// only exposes what's actually enforced. Bank statements/reports are still
// unexposed here for the same reason.
const MODULES = [
  { key: "invoices", label: "Invoices", actions: ["view", "create", "edit", "delete", "export"] },
  { key: "customers", label: "Customers", actions: ["view", "create", "edit", "delete"] },
  { key: "suppliers", label: "Suppliers", actions: ["view", "create", "edit", "delete"] },
];

const EMPTY_PERMISSIONS = MODULES.reduce((acc, m) => ({ ...acc, [m.key]: [] }), {});

function StatusBadge({ status }) {
  const styles = {
    ACTIVE: "bg-green-50 text-green-700",
    SUSPENDED: "bg-amber-50 text-amber-700",
    INVITED: "bg-slate-100 text-slate-600",
    REMOVED: "bg-red-50 text-red-600",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[status] || styles.INVITED}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export default function TeamAccess() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermissions, setInvitePermissions] = useState(EMPTY_PERMISSIONS);
  const [inviting, setInviting] = useState(false);

  function toggleInviteAction(moduleKey, action) {
    setInvitePermissions((prev) => {
      const current = prev[moduleKey] || [];
      const next = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action];
      return { ...prev, [moduleKey]: next };
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const res = await companyApi.listTeam();
      setMembers(res.data.members || []);
    } catch (err) {
      toast.error(err.response?.data?.error || "Unable to load team.");
    } finally {
      setLoading(false);
    }
  }

  async function invite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    try {
      await companyApi.inviteFreelancer(inviteEmail.trim(), invitePermissions);
      toast.success("Invitation sent.");
      setInviteEmail("");
      setInvitePermissions(EMPTY_PERMISSIONS);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't send invitation.");
    } finally {
      setInviting(false);
    }
  }

  async function togglePermission(member, moduleKey, action) {
    const current = member.permissions?.[moduleKey] || [];
    const next = current.includes(action)
      ? current.filter((a) => a !== action)
      : [...current, action];
    const nextPermissions = { ...member.permissions, [moduleKey]: next };

    try {
      await companyApi.updateMember(member.membershipId, { permissions: nextPermissions });
      setMembers((prev) =>
        prev.map((m) =>
          m.membershipId === member.membershipId ? { ...m, permissions: nextPermissions } : m
        )
      );
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't update permissions.");
    }
  }

  async function toggleStatus(member) {
    const next = member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await companyApi.updateMember(member.membershipId, { status: next });
      setMembers((prev) =>
        prev.map((m) => (m.membershipId === member.membershipId ? { ...m, status: next } : m))
      );
      toast.success(next === "ACTIVE" ? "Access reactivated." : "Access suspended.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't update status.");
    }
  }

  async function remove(member) {
    try {
      await companyApi.removeMember(member.membershipId);
      setMembers((prev) => prev.filter((m) => m.membershipId !== member.membershipId));
      toast.success(`${member.name} removed. Their access ended immediately.`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't remove team member.");
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow">
      <div className="flex items-center gap-2 border-b border-slate-200 px-8 py-6">
        <Users size={20} className="text-blue-600" />
        <h2 className="text-xl font-semibold text-black">Team &amp; Access</h2>
      </div>

      {/* Invite form */}
      <form onSubmit={invite} className="border-b border-slate-200 px-8 py-6">
        <p className="mb-3 text-sm font-medium text-slate-700">Invite a freelancer</p>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="freelancer@example.com"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={inviting}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              <UserPlus size={16} />
              Invite
            </button>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {MODULES.map((module) => (
              <div key={module.key}>
                <p className="mb-1.5 text-xs font-medium text-slate-500">{module.label}</p>
                <div className="flex flex-wrap gap-2">
                  {module.actions.map((action) => (
                    <label
                      key={action}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600"
                    >
                      <input
                        type="checkbox"
                        checked={(invitePermissions[module.key] || []).includes(action)}
                        onChange={() => toggleInviteAction(module.key, action)}
                      />
                      {action}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          They must already have a Freelancer account.
        </p>
      </form>

      {/* Member list */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-8 py-4 font-medium">Freelancer</th>
              <th className="px-8 py-4 font-medium">Status</th>
              {MODULES.map((module) => (
                <th key={module.key} className="px-8 py-4 font-medium">{module.label}</th>
              ))}
              <th className="px-8 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3 + MODULES.length} className="px-8 py-10 text-center text-slate-500">Loading team...</td>
              </tr>
            ) : members.filter((m) => m.role !== "OWNER").length === 0 ? (
              <tr>
                <td colSpan={3 + MODULES.length} className="px-8 py-10 text-center text-slate-500">
                  No freelancers invited yet.
                </td>
              </tr>
            ) : (
              members
                .filter((m) => m.role !== "OWNER")
                .map((m) => (
                  <tr key={m.membershipId} className="border-b border-slate-100 align-top">
                    <td className="px-8 py-4">
                      <p className="font-medium text-slate-800">{m.name}</p>
                      <p className="text-xs text-slate-400">{m.email}</p>
                    </td>
                    <td className="px-8 py-4">
                      <StatusBadge status={m.status} />
                    </td>
                    {MODULES.map((module) => (
                      <td key={module.key} className="px-8 py-4">
                        {m.status === "INVITED" ? (
                          <span className="text-xs text-slate-400">Pending acceptance</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {module.actions.map((action) => {
                              const active = (m.permissions?.[module.key] || []).includes(action);
                              return (
                                <button
                                  key={action}
                                  onClick={() => togglePermission(m, module.key, action)}
                                  className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                                    active
                                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                      : "border-slate-200 text-slate-400 hover:border-slate-300"
                                  }`}
                                >
                                  {action}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        {m.status !== "INVITED" && (
                          <button
                            onClick={() => toggleStatus(m)}
                            title={m.status === "ACTIVE" ? "Suspend access" : "Reactivate access"}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                          >
                            {m.status === "ACTIVE" ? <Pause size={15} /> : <Play size={15} />}
                          </button>
                        )}
                        <button
                          onClick={() => remove(m)}
                          title="Remove access"
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-500 transition hover:bg-red-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
