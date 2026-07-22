import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, FileText, CreditCard, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import AdminPageShell from "../../components/admin/AdminPageShell";
import adminApi from "../../services/adminApi";

const statConfig = [
  { key: "totalCustomers", label: "Total Customers", icon: Users, color: "from-violet-500 to-purple-600" },
  { key: "activeSubscriptions", label: "Active Subscriptions", icon: CreditCard, color: "from-blue-500 to-indigo-600" },
  { key: "totalInvoices", label: "Total Invoices", icon: FileText, color: "from-emerald-500 to-teal-600" },
  { key: "monthlyRevenue", label: "Monthly Revenue", icon: TrendingUp, color: "from-amber-500 to-orange-600", prefix: "$" },
];

function formatValue(key, value) {
  if (value == null) return "—";

  if (key === "monthlyRevenue") {
    return `$${Number(value).toLocaleString()}`;
  }

  return Number(value).toLocaleString();
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [planDistribution, setPlanDistribution] = useState([]);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const data = await adminApi.getStats();
        setStats(data.stats);
        setRecentCustomers(data.recentCustomers || []);
        setPlanDistribution(data.planDistribution || []);
      } catch (error) {
        toast.error(
          error.response?.data?.error || "Failed to load admin dashboard"
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  return (
    <AdminPageShell
      title="Dashboard"
      description="Overview of all customers, subscriptions, and platform activity."
    >
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {statConfig.map((stat) => {
          const Icon = stat.icon;
          const value = stats ? formatValue(stat.key, stats[stat.key]) : "—";

          return (
            <div
              key={stat.key}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {loading ? "..." : value}
                  </p>
                </div>

                <div className={`rounded-xl bg-gradient-to-r ${stat.color} p-3 text-white`}>
                  <Icon size={22} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Customers
          </h2>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading...</p>
          ) : recentCustomers.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No customers registered yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {recentCustomers.map((customer) => (
                <Link
                  key={customer.id}
                  to={`/admin/customers/${customer.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 transition hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {customer.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {customer.email}
                    </p>
                  </div>

                  <div className="text-right text-sm">
                    <p className="capitalize text-violet-600">
                      {customer.plan}
                    </p>
                    <p className="text-slate-400">
                      {customer.invoice_count} invoices
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Subscription Overview
          </h2>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading...</p>
          ) : planDistribution.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No subscription data yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {planDistribution.map((item) => (
                <div
                  key={item.plan}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                >
                  <span className="capitalize font-medium text-slate-700">
                    {item.plan}
                  </span>
                  <span className="text-sm text-slate-500">
                    {item.count} customer{item.count === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminPageShell>
  );
}
