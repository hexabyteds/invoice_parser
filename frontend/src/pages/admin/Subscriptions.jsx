import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Loader2,
  RefreshCw,
  Pencil,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import AdminPageShell from "../../components/admin/AdminPageShell";
import ChangeSubscriptionModal from "../../components/admin/ChangeSubscriptionModal";
import adminApi from "../../services/adminApi";

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();

  const styles = {
    active: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-red-100 text-red-700",
    expired: "bg-slate-100 text-slate-600",
    trial: "bg-blue-100 text-blue-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize ${
        styles[normalized] || "bg-slate-100 text-slate-600"
      }`}
    >
      {normalized}
    </span>
  );
}

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [changeModalOpen, setChangeModalOpen] = useState(false);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getSubscriptions();
      setSubscriptions(data.subscriptions || []);
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Unable to load subscriptions."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const filteredSubscriptions = useMemo(() => {
    const keyword = search.toLowerCase();

    return subscriptions.filter((item) => {
      const matchesSearch =
        item.customer_name?.toLowerCase().includes(keyword) ||
        item.customer_email?.toLowerCase().includes(keyword) ||
        item.company_name?.toLowerCase().includes(keyword) ||
        item.plan_name?.toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "all" ||
        String(item.status).toLowerCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [subscriptions, search, statusFilter]);

  const handleChangePlan = (subscription) => {
    setSelectedSubscription(subscription);
    setChangeModalOpen(true);
  };

  return (
    <AdminPageShell
      title="Subscriptions"
      description="View and manage customer subscription plans."
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search
            size={18}
            className="absolute left-4 top-3.5 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, company, plan..."
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>

          <button
            onClick={loadSubscriptions}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 text-left font-medium">Customer</th>
                <th className="px-4 py-4 text-left font-medium">Company</th>
                <th className="px-4 py-4 text-left font-medium">Plan</th>
                <th className="px-4 py-4 text-left font-medium">Billing</th>
                <th className="px-4 py-4 text-left font-medium">Status</th>
                <th className="px-4 py-4 text-left font-medium">Started</th>
                <th className="px-4 py-4 text-left font-medium">Expires</th>
                <th className="px-6 py-4 text-center font-medium">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    <Loader2 className="mx-auto animate-spin" size={28} />
                  </td>
                </tr>
              ) : filteredSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    No subscriptions found.
                  </td>
                </tr>
              ) : (
                filteredSubscriptions.map((subscription) => (
                  <tr
                    key={subscription.id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-6 py-5">
                      <div className="font-semibold text-slate-900">
                        {subscription.customer_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {subscription.customer_email}
                      </div>
                    </td>

                    <td className="px-4 py-5 text-slate-700">
                      {subscription.company_name || "—"}
                    </td>

                    <td className="px-4 py-5">
                      <div className="font-medium capitalize text-slate-900">
                        {subscription.plan_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        ${subscription.price.toFixed(2)}
                      </div>
                    </td>

                    <td className="px-4 py-5 capitalize text-slate-700">
                      {subscription.billing_cycle}
                    </td>

                    <td className="px-4 py-5">
                      <StatusBadge status={subscription.status} />
                    </td>

                    <td className="px-4 py-5 text-slate-700">
                      {formatDate(subscription.starts_at)}
                    </td>

                    <td className="px-4 py-5 text-slate-700">
                      {formatDate(subscription.expires_at)}
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleChangePlan(subscription)}
                          className="rounded-lg p-2 text-slate-600 hover:bg-violet-100 hover:text-violet-700"
                          title="Change plan"
                        >
                          <Pencil size={18} />
                        </button>

                        <Link
                          to={`/admin/customers/${subscription.user_id}`}
                          className="rounded-lg p-2 text-slate-600 hover:bg-blue-100 hover:text-blue-700"
                          title="View customer"
                        >
                          <ExternalLink size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ChangeSubscriptionModal
        open={changeModalOpen}
        subscription={selectedSubscription}
        onClose={() => setChangeModalOpen(false)}
        onSaved={loadSubscriptions}
      />
    </AdminPageShell>
  );
}
