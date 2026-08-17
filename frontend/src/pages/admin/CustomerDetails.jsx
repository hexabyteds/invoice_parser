import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import AdminPageShell from "../../components/admin/AdminPageShell";
import CustomerManagePanel from "../../components/admin/CustomerManagePanel";
import adminApi from "../../services/adminApi";

export default function CustomerDetails() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [clients, setClients] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);

  const loadCustomer = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminApi.getCustomer(id);
      setCustomer(data.customer);
      setClients(data.clients || []);
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Failed to load customer"
      );
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  useEffect(() => {
    adminApi
      .getCustomerLoginHistory(id)
      .then((data) => setLoginHistory(data.history || []))
      .catch(() => setLoginHistory([]));
  }, [id]);

  if (loading) {
    return (
      <AdminPageShell
        title="Customer Details"
        description="Loading customer profile..."
      />
    );
  }

  if (!customer) {
    return (
      <AdminPageShell
        title="Customer Details"
        description="Customer not found."
      >
        <Link
          to="/admin/customers"
          className="inline-flex text-sm font-medium text-violet-600 hover:text-violet-700"
        >
          ← Back to customers
        </Link>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      title={customer.name}
      description={customer.email}
    >
      <Link
        to="/admin/customers"
        className="inline-flex text-sm font-medium text-violet-600 hover:text-violet-700"
      >
        ← Back to customers
      </Link>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Plan</p>
          <p className="mt-2 text-xl font-semibold capitalize text-slate-900">
            {customer.plan}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Status</p>
          <p className="mt-2 text-xl font-semibold capitalize text-slate-900">
            {customer.status}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total Clients</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {customer.total_clients ?? customer.client_count ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Invoices</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {customer.invoice_count}
          </p>
        </div>
      </div>

      <CustomerManagePanel
        key={customer.id}
        customer={customer}
        onUpdated={loadCustomer}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Account Info
        </h2>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500">Company</dt>
            <dd className="font-medium text-slate-900">
              {customer.company_name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Phone</dt>
            <dd className="font-medium text-slate-900">
              {customer.phone || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Country</dt>
            <dd className="font-medium text-slate-900">
              {customer.country || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Joined</dt>
            <dd className="font-medium text-slate-900">
              {customer.created_at
                ? new Date(customer.created_at).toLocaleDateString()
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Invoice Volume</dt>
            <dd className="font-medium text-slate-900">
              ${Number(customer.invoice_total || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </dd>
          </div>
        </dl>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Clients
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">Company</th>
                <th className="px-6 py-4 font-medium">Contact</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Invoices</th>
              </tr>
            </thead>

            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                    No clients for this customer.
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-slate-100"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {client.company_name}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {client.contact_person || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {client.email || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {client.invoice_count}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Login History
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">Date &amp; Time</th>
                <th className="px-6 py-4 font-medium">Device</th>
                <th className="px-6 py-4 font-medium">Browser</th>
                <th className="px-6 py-4 font-medium">IP Address</th>
              </tr>
            </thead>

            <tbody>
              {loginHistory.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                    No login activity recorded for this customer.
                  </td>
                </tr>
              ) : (
                loginHistory.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100">
                    <td className="px-6 py-4 text-slate-700">
                      {entry.login_time
                        ? new Date(entry.login_time).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {entry.device || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {entry.browser || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {entry.ip_address || "—"}
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
