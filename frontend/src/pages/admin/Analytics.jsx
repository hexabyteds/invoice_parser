import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import toast from "react-hot-toast";
import {
  Users,
  Building2,
  Briefcase,
  FileText,
  Truck,
  Landmark,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  CheckCircle2,
} from "lucide-react";
import AdminPageShell from "../../components/admin/AdminPageShell";
import adminApi from "../../services/adminApi";

const RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "12m", label: "12 Months" },
];

const PLAN_COLORS = { free: "#94a3b8", pro: "#6366f1", max: "#7c3aed" };

function SummaryCard({ icon: Icon, label, value, accent, sub }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>
          <Icon size={17} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function SectionCard({ title, description, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [details, setDetails] = useState(null);
  const [range, setRange] = useState("30d");
  const [growthMetric, setGrowthMetric] = useState("companies");
  const [growth, setGrowth] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [summaryRes, detailsRes] = await Promise.all([
          adminApi.getAnalyticsSummary(),
          adminApi.getAnalyticsDetails(range),
        ]);
        setSummary(summaryRes.summary);
        setDetails(detailsRes);
      } catch (error) {
        toast.error(error.response?.data?.error || "Failed to load analytics.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [range]);

  useEffect(() => {
    adminApi
      .getAnalyticsGrowth({ metric: growthMetric, range })
      .then((res) => setGrowth(res.series || []))
      .catch(() => setGrowth([]));
  }, [growthMetric, range]);

  if (loading || !summary || !details) {
    return <AdminPageShell title="Analytics" description="Loading..." />;
  }

  const planRows = [...details.plans.company, ...details.plans.freelancer];
  const planTotals = {};
  for (const row of planRows) {
    const slug = row.plan_slug || "unassigned";
    planTotals[slug] = (planTotals[slug] || 0) + Number(row.count);
  }
  const planChartData = Object.entries(planTotals).map(([slug, count]) => ({ slug, count }));

  return (
    <AdminPageShell
      title="Analytics"
      description="How the platform is performing — growth, plans, subscriptions, documents, and usage."
    >
      <div className="flex justify-end">
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500"
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        <SummaryCard icon={Users} label="Total Users" value={summary.totalUsers} accent="bg-indigo-50 text-indigo-600" />
        <SummaryCard icon={Building2} label="Total Companies" value={summary.totalCompanies} sub={`${summary.activeCompanies} active`} accent="bg-emerald-50 text-emerald-600" />
        <SummaryCard icon={Briefcase} label="Total Freelancers" value={summary.totalFreelancers} sub={`${summary.activeFreelancers} active`} accent="bg-violet-50 text-violet-600" />
        <SummaryCard icon={DollarSign} label="MRR" value={`AED ${summary.mrr.toFixed(2)}`} accent="bg-amber-50 text-amber-600" />
        <SummaryCard icon={Users} label="Total Customers" value={summary.totalCustomers} accent="bg-emerald-50 text-emerald-600" />
        <SummaryCard icon={Truck} label="Total Suppliers" value={summary.totalSuppliers} accent="bg-cyan-50 text-cyan-600" />
        <SummaryCard icon={FileText} label="Invoices / Bills" value={`${summary.totalInvoices} / ${summary.totalBills}`} accent="bg-blue-50 text-blue-600" />
        <SummaryCard icon={Landmark} label="Bank Statements" value={summary.totalBankStatements} accent="bg-purple-50 text-purple-600" />
        <SummaryCard icon={CheckCircle2} label="Documents Processed" value={summary.totalDocumentsProcessed} accent="bg-emerald-50 text-emerald-600" />
        <SummaryCard icon={AlertTriangle} label="Failed Documents" value={summary.failedDocuments} accent="bg-red-50 text-red-600" />
        <SummaryCard icon={TrendingUp} label="Active Subscriptions" value={summary.activeSubscriptions} accent="bg-indigo-50 text-indigo-600" />
      </div>

      <SectionCard title="Growth" description="New sign-ups over the selected range.">
        <div className="mb-4 flex gap-2">
          {["users", "companies", "freelancers"].map((m) => (
            <button
              key={m}
              onClick={() => setGrowthMetric(m)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                growthMetric === m ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growth} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
              <Area type="monotone" dataKey="count" name="New" stroke="#6366f1" fill="url(#growthFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Plan Distribution" description="Companies and Freelancers by plan.">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={planChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="slug" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {planChartData.map((entry) => (
                    <Cell key={entry.slug} fill={PLAN_COLORS[entry.slug] || "#cbd5e1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Subscription Analytics" description="Real-time counts from local subscription records.">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-slate-500">Active</p><p className="text-xl font-bold text-slate-900">{summary.activeSubscriptions}</p></div>
            <div><p className="text-slate-500">Upgrades ({range})</p><p className="text-xl font-bold text-emerald-600">+{details.subscriptions.upgrades}</p></div>
            <div><p className="text-slate-500">Downgrades ({range})</p><p className="text-xl font-bold text-amber-600">-{details.subscriptions.downgrades}</p></div>
            <div><p className="text-slate-500">Documents Failed</p><p className="text-xl font-bold text-red-600">{details.documents.totals.failed}</p></div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Document Analytics" description={`Invoices vs Bills over the selected range — ${details.documents.totals.invoices + details.documents.totals.bills} total.`}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={details.documents.series} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="invoicesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="billsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
              <Area type="monotone" dataKey="invoices" name="Invoices" stroke="#3b82f6" fill="url(#invoicesFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="bills" name="Bills" stroke="#f59e0b" fill="url(#billsFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="Companies Near / At Usage Limit" description="Click through to review a company's own Usage tab.">
        {details.usage.nearLimitCompanies.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No companies currently near their plan limits.</p>
        ) : (
          <div className="space-y-3">
            {details.usage.nearLimitCompanies.map((c) => (
              <Link
                key={c.id}
                to={`/admin/companies/${c.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 transition hover:border-indigo-300 hover:bg-indigo-50/40"
              >
                <div>
                  <p className="font-medium text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-400">
                    Customers {c.customers.used}/{c.customers.limit ?? "∞"} · Suppliers {c.suppliers.used}/{c.suppliers.limit ?? "∞"} · Invoices {c.invoices.used}/{c.invoices.limit ?? "∞"}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${c.usageRatio >= 1 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                  {Math.round(c.usageRatio * 100)}%
                </span>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Freelancer Analytics" description="How Freelancers are using multi-company management.">
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
          <div><p className="text-slate-500">Total Freelancers</p><p className="text-xl font-bold text-slate-900">{details.freelancers.totalFreelancers}</p></div>
          <div><p className="text-slate-500">Avg Companies / Freelancer</p><p className="text-xl font-bold text-slate-900">{details.freelancers.avgCompaniesPerFreelancer.toFixed(1)}</p></div>
          <div><p className="text-slate-500">Max Managed by One</p><p className="text-xl font-bold text-slate-900">{details.freelancers.maxCompaniesManaged}</p></div>
          <div><p className="text-slate-500">Total Managed Companies</p><p className="text-xl font-bold text-slate-900">{details.freelancers.totalManagedCompanies}</p></div>
        </div>

        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Most Active Freelancers</p>
        <div className="space-y-2">
          {details.freelancers.mostActive.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-800">{f.name}</p>
                <p className="text-xs text-slate-400">{f.email}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>{f.companiesManaged} companies</p>
                <p>{f.documentCount} documents</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </AdminPageShell>
  );
}
