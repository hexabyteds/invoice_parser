import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import AdminPageShell from "../../components/admin/AdminPageShell";
import adminApi from "../../services/adminApi";

function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();
  const styles =
    normalized === "active"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-slate-100 text-slate-600";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${styles}`}>
      {status}
    </span>
  );
}

export default function Customers() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    async function loadCustomers() {
      try {
        const data = await adminApi.getCustomers();
        setCustomers(data.customers || []);
      } catch (error) {
        toast.error(
          error.response?.data?.error || "Failed to load customers"
        );
      } finally {
        setLoading(false);
      }
    }

    loadCustomers();
  }, []);

  return (
    <AdminPageShell
      title="Customers"
      description="View and manage all registered customer accounts."
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">Customer</th>
                <th className="px-6 py-4 font-medium">Company</th>
                <th className="px-6 py-4 font-medium">Plan</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Total Clients</th>
                <th className="px-6 py-4 font-medium">Invoices</th>
                <th className="px-6 py-4 font-medium">Joined</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    No customers found.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="px-6 py-4">
                      <Link
                        to={`/admin/customers/${customer.id}`}
                        className="font-medium text-violet-600 hover:text-violet-700"
                      >
                        {customer.name}
                      </Link>
                      <p className="text-slate-500">{customer.email}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {customer.company_name || "—"}
                    </td>
                    <td className="px-6 py-4 capitalize text-slate-700">
                      {customer.plan}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={customer.status} />
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {customer.total_clients ?? customer.client_count ?? 0}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {customer.invoice_count}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {customer.created_at
                        ? new Date(customer.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageShell>
  );
}
