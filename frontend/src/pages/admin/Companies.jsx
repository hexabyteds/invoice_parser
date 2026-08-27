import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Building2,
  CheckCircle2,
  PauseCircle,
  Gauge,
  Sparkles,
  Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import AdminPageShell from "../../components/admin/AdminPageShell";
import adminApi from "../../services/adminApi";

const ROWS_PER_PAGE = 20;

const STATUS_STYLES = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  SUSPENDED: "bg-amber-100 text-amber-700",
  DEACTIVATED: "bg-red-100 text-red-600",
};

function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
        STATUS_STYLES[status] || "bg-slate-100 text-slate-600"
      }`}
    >
      {status?.toLowerCase()}
    </span>
  );
}

function UsageBadge({ ratio }) {
  if (ratio >= 1) {
    return <span className="text-xs font-semibold text-red-600">Limit reached</span>;
  }
  if (ratio >= 0.7) {
    return <span className="text-xs font-semibold text-amber-600">Near limit</span>;
  }
  return <span className="text-xs text-slate-400">Normal</span>;
}

function SummaryCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>
          <Icon size={17} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default function Companies() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [usage, setUsage] = useState("all");

  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    adminApi
      .getCompaniesSummary()
      .then((data) => setSummary(data.summary))
      .catch(() => setSummary(null));
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
        const data = await adminApi.getCompanies({
          limit: ROWS_PER_PAGE,
          offset,
          search,
          plan,
          status,
          source,
          usage,
        });
        setCompanies(data.companies || []);
        setTotal(data.pagination?.total ?? 0);
      } catch (error) {
        toast.error(error.response?.data?.error || "Failed to load companies.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [safePage, search, plan, status, source, usage]);

  const rangeStart = total === 0 ? 0 : (safePage - 1) * ROWS_PER_PAGE + 1;
  const rangeEnd = Math.min(safePage * ROWS_PER_PAGE, total);

  const selectClass =
    "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500";

  return (
    <AdminPageShell
      title="Companies"
      description="Monitor and manage every Company workspace — Direct or Freelancer-managed."
    >
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          <SummaryCard icon={Building2} label="Total Companies" value={summary.total} accent="bg-indigo-50 text-indigo-600" />
          <SummaryCard icon={CheckCircle2} label="Active" value={summary.active} accent="bg-emerald-50 text-emerald-600" />
          <SummaryCard icon={PauseCircle} label="Suspended / Deactivated" value={summary.suspended + summary.deactivated} accent="bg-amber-50 text-amber-600" />
          <SummaryCard icon={Sparkles} label="Recently Created (7d)" value={summary.recentlyCreated} accent="bg-violet-50 text-violet-600" />
          <SummaryCard icon={Building2} label="Free Plan" value={summary.freePlan} accent="bg-slate-100 text-slate-600" />
          <SummaryCard icon={Building2} label="Pro Plan" value={summary.proPlan} accent="bg-blue-50 text-blue-600" />
          <SummaryCard icon={Building2} label="Max Plan" value={summary.maxPlan} accent="bg-purple-50 text-purple-600" />
          <SummaryCard icon={Gauge} label="Near / At Usage Limit" value={summary.nearLimit + summary.limitReached} accent="bg-red-50 text-red-600" />
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, ID, email, phone, TRN, freelancer..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} className={selectClass}>
            <option value="all">All Plans</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="max">Max</option>
          </select>

          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectClass}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
          </select>

          <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} className={selectClass}>
            <option value="all">All Sources</option>
            <option value="direct">Direct Company</option>
            <option value="freelancer_created">Freelancer Created</option>
            <option value="freelancer_managed">Freelancer Managed</option>
          </select>

          <select value={usage} onChange={(e) => { setUsage(e.target.value); setPage(1); }} className={selectClass}>
            <option value="all">All Usage</option>
            <option value="normal">Normal</option>
            <option value="near">Near Limit</option>
            <option value="reached">Limit Reached</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">Company</th>
                <th className="px-4 py-4 font-medium">Created By</th>
                <th className="px-4 py-4 font-medium">Plan</th>
                <th className="px-4 py-4 font-medium">Status</th>
                <th className="px-4 py-4 font-medium">Customers</th>
                <th className="px-4 py-4 font-medium">Suppliers</th>
                <th className="px-4 py-4 font-medium">Invoices</th>
                <th className="px-4 py-4 font-medium">Usage</th>
                <th className="px-4 py-4 font-medium">Created</th>
                <th className="px-6 py-4 text-center font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-slate-500">
                    Loading companies...
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-slate-500">
                    No companies found.
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company.id} className="border-b border-slate-100 transition hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <Link
                        to={`/admin/companies/${company.id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        {company.name}
                      </Link>
                      <p className="text-xs text-slate-400">{company.code}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {company.createdBy === "FREELANCER" ? (
                        <div>
                          <p className="capitalize">Freelancer</p>
                          <p className="text-xs text-slate-400">{company.freelancer?.name}</p>
                        </div>
                      ) : (
                        "Company"
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-700">{company.plan}</td>
                    <td className="px-4 py-4">
                      <StatusBadge status={company.status} />
                    </td>
                    <td className="px-4 py-4 text-slate-700">{company.usage.customers}</td>
                    <td className="px-4 py-4 text-slate-700">{company.usage.suppliers}</td>
                    <td className="px-4 py-4 text-slate-700">{company.usage.invoices}</td>
                    <td className="px-4 py-4">
                      <UsageBadge ratio={company.usage.ratio} />
                    </td>
                    <td className="px-4 py-4 text-slate-500">
                      {company.createdAt ? new Date(company.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Link
                        to={`/admin/companies/${company.id}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-indigo-100 hover:text-indigo-700"
                        title="View company"
                      >
                        <Eye size={17} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && total > 0 && (
          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row">
            <p className="text-sm text-slate-600">
              Showing {rangeStart}–{rangeEnd} of {total} companies
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft size={18} />
                Previous
              </button>

              <span className="px-2 text-sm text-slate-600">
                Page {safePage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}
