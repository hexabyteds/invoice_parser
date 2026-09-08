import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import AdminPageShell from "../../components/admin/AdminPageShell";
import adminApi from "../../services/adminApi";

const ROWS_PER_PAGE = 20;

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

function EmailVerifiedBadge({ verified }) {
  const styles = verified
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles}`}>
      {verified ? "Verified" : "Not Verified"}
    </span>
  );
}

export default function Customers() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    async function loadCustomers() {
      try {
        setLoading(true);
        const offset = (safePage - 1) * ROWS_PER_PAGE;
        const data = await adminApi.getCustomers({
          limit: ROWS_PER_PAGE,
          offset,
        });
        setCustomers(data.customers || []);
        setTotal(data.pagination?.total ?? data.customers?.length ?? 0);
      } catch (error) {
        toast.error(
          error.response?.data?.error || "Failed to load customers"
        );
      } finally {
        setLoading(false);
      }
    }

    loadCustomers();
  }, [safePage]);

  const rangeStart = total === 0 ? 0 : (safePage - 1) * ROWS_PER_PAGE + 1;
  const rangeEnd = Math.min(safePage * ROWS_PER_PAGE, total);

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
                <th className="px-6 py-4 font-medium">Email Verified</th>
                <th className="px-6 py-4 font-medium">Total Clients</th>
                <th className="px-6 py-4 font-medium">Invoices</th>
                <th className="px-6 py-4 font-medium">Joined</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
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
                        className="font-medium text-indigo-600 hover:text-indigo-700"
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
                    <td className="px-6 py-4">
                      <EmailVerifiedBadge verified={customer.email_verified} />
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

        {!loading && total > 0 && (
          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row">
            <p className="text-sm text-slate-600">
              Showing {rangeStart}–{rangeEnd} of {total} customers
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
