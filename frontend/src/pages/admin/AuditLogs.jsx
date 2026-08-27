import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ChevronLeft, ChevronRight, X, Eye } from "lucide-react";
import toast from "react-hot-toast";
import AdminPageShell from "../../components/admin/AdminPageShell";
import adminApi from "../../services/adminApi";

const ROWS_PER_PAGE = 25;

const MODULES = [
  "Authentication",
  "Company",
  "Freelancer",
  "Customer",
  "Supplier",
  "Invoice",
  "Bank Statement",
  "Export",
  "Billing",
  "Admin",
];

function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        status === "FAILED" ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {status === "FAILED" ? "Failed" : "Success"}
    </span>
  );
}

function DetailDrawer({ log, onClose }) {
  if (!log) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Audit Log Detail</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div><p className="text-xs text-slate-400">Action</p><p className="font-medium text-slate-800">{log.action}</p></div>
          <div><p className="text-xs text-slate-400">Date</p><p className="font-medium text-slate-800">{new Date(log.createdAt).toLocaleString()}</p></div>
          <div><p className="text-xs text-slate-400">Performed By</p><p className="font-medium text-slate-800">{log.user ? `${log.user.name} (${log.user.email})` : "System"}</p></div>
          <div><p className="text-xs text-slate-400">Account Type</p><p className="font-medium text-slate-800">{log.accountType}</p></div>
          <div><p className="text-xs text-slate-400">Company</p>
            {log.company ? (
              <Link to={`/admin/companies/${log.company.id}`} className="font-medium text-indigo-600 hover:text-indigo-700">
                {log.company.name}
              </Link>
            ) : (
              <p className="font-medium text-slate-800">—</p>
            )}
          </div>
          <div><p className="text-xs text-slate-400">Module</p><p className="font-medium text-slate-800">{log.module}</p></div>
          <div><p className="text-xs text-slate-400">Status</p><StatusBadge status={log.status} /></div>
          <div><p className="text-xs text-slate-400">IP Address</p><p className="font-medium text-slate-800">{log.ipAddress || "—"}</p></div>
          <div><p className="text-xs text-slate-400">Additional Information</p><p className="font-medium text-slate-800">{log.description || "—"}</p></div>
        </div>
      </div>
    </div>
  );
}

export default function AuditLogs() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actions, setActions] = useState([]);
  const [selected, setSelected] = useState(null);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [module, setModule] = useState("all");
  const [status, setStatus] = useState("all");
  const [accountType, setAccountType] = useState("all");
  const [action, setAction] = useState("all");

  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    adminApi.getAuditLogFilterOptions().then((res) => setActions(res.actions || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const offset = (safePage - 1) * ROWS_PER_PAGE;
        const data = await adminApi.getAuditLogs({
          limit: ROWS_PER_PAGE,
          offset,
          search,
          module,
          status,
          accountType,
          action,
        });
        setLogs(data.logs || []);
        setTotal(data.pagination?.total ?? 0);
      } catch (error) {
        toast.error(error.response?.data?.error || "Failed to load audit logs.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [safePage, search, module, status, accountType, action]);

  const rangeStart = total === 0 ? 0 : (safePage - 1) * ROWS_PER_PAGE + 1;
  const rangeEnd = Math.min(safePage * ROWS_PER_PAGE, total);
  const selectClass = "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500";

  return (
    <AdminPageShell title="Audit Logs" description="Who did what, when, and to which Company or resource.">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search user, email, company, action..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <select value={module} onChange={(e) => { setModule(e.target.value); setPage(1); }} className={selectClass}>
            <option value="all">All Modules</option>
            {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>

          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className={selectClass}>
            <option value="all">All Actions</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>

          <select value={accountType} onChange={(e) => { setAccountType(e.target.value); setPage(1); }} className={selectClass}>
            <option value="all">All Account Types</option>
            <option value="COMPANY">Company</option>
            <option value="FREELANCER">Freelancer</option>
            <option value="ADMIN">Super Admin</option>
          </select>

          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectClass}>
            <option value="all">All Statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">Date/Time</th>
                <th className="px-4 py-4 font-medium">User</th>
                <th className="px-4 py-4 font-medium">Company</th>
                <th className="px-4 py-4 font-medium">Module</th>
                <th className="px-4 py-4 font-medium">Action</th>
                <th className="px-4 py-4 font-medium">Status</th>
                <th className="px-6 py-4 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500">Loading audit logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500">No audit log entries found.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-6 py-4 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-800">{log.user?.name || "System"}</p>
                      <p className="text-xs text-slate-400">{log.accountType}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{log.company?.name || "—"}</td>
                    <td className="px-4 py-4 text-slate-700">{log.module}</td>
                    <td className="px-4 py-4 text-slate-700">{log.action}</td>
                    <td className="px-4 py-4"><StatusBadge status={log.status} /></td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelected(log)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-indigo-100 hover:text-indigo-700"
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && total > 0 && (
          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row">
            <p className="text-sm text-slate-600">Showing {rangeStart}–{rangeEnd} of {total} events</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40">
                <ChevronLeft size={18} /> Previous
              </button>
              <span className="px-2 text-sm text-slate-600">Page {safePage} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40">
                Next <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <DetailDrawer log={selected} onClose={() => setSelected(null)} />
    </AdminPageShell>
  );
}
