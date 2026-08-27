import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DollarSign, TrendingUp, CheckCircle2, XCircle, RotateCcw, Eye, X } from "lucide-react";
import toast from "react-hot-toast";
import AdminPageShell from "../../components/admin/AdminPageShell";
import adminApi from "../../services/adminApi";

const STATUS_STYLES = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-600",
};

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

function StatusBadge({ status }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] || "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

function PaymentDetailModal({ paymentId, onClose }) {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!paymentId) return;
    setLoading(true);
    adminApi
      .getPaymentDetail(paymentId)
      .then((res) => setPayment(res.payment))
      .catch((error) => toast.error(error.response?.data?.error || "Failed to load payment."))
      .finally(() => setLoading(false));
  }, [paymentId]);

  if (!paymentId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Payment Details</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading...</p>
        ) : !payment ? (
          <p className="py-8 text-center text-sm text-slate-500">Payment not found.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div><p className="text-xs text-slate-400">Customer</p><p className="font-medium text-slate-800">{payment.customer?.name || "—"}</p></div>
            <div><p className="text-xs text-slate-400">Account Type</p><p className="font-medium text-slate-800">{payment.accountType || "—"}</p></div>
            {payment.company && (
              <div><p className="text-xs text-slate-400">Company</p>
                <Link to={`/admin/companies/${payment.company.id}`} className="font-medium text-indigo-600 hover:text-indigo-700">
                  {payment.company.name}
                </Link>
              </div>
            )}
            <div><p className="text-xs text-slate-400">Amount</p><p className="font-medium text-slate-800">{payment.currency} {payment.amount.toFixed(2)}</p></div>
            <div><p className="text-xs text-slate-400">Status</p><StatusBadge status={payment.status} /></div>
            <div><p className="text-xs text-slate-400">Payment Date</p><p className="font-medium text-slate-800">{payment.date ? new Date(payment.date).toLocaleString() : "—"}</p></div>
            <div><p className="text-xs text-slate-400">Payment Method</p><p className="font-medium text-slate-800">{payment.paymentMethod || "—"}</p></div>

            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Advanced / Technical Information</p>
              <p className="text-xs text-slate-500">Stripe Invoice ID: {payment.stripeInvoiceId}</p>
              <p className="text-xs text-slate-500">Stripe Customer ID: {payment.stripeCustomerId}</p>
              {payment.stripeSubscriptionId && <p className="text-xs text-slate-500">Stripe Subscription ID: {payment.stripeSubscriptionId}</p>}
            </div>

            {payment.hostedInvoiceUrl && (
              <a href={payment.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="inline-block text-xs font-medium text-indigo-600 hover:text-indigo-700">
                View on Stripe →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Payments() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [stripeConfigured, setStripeConfigured] = useState(true);

  useEffect(() => {
    adminApi.getPaymentsSummary().then((res) => setSummary(res.summary)).catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await adminApi.getPayments({ limit: 20, status: status === "all" ? undefined : status });
        setPayments(data.payments || []);
        setHasMore(Boolean(data.hasMore));
        setStripeConfigured(data.stripeConfigured !== false);
      } catch (error) {
        toast.error(error.response?.data?.error || "Failed to load payments.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [status]);

  const loadMore = async () => {
    if (!payments.length) return;
    try {
      const data = await adminApi.getPayments({
        limit: 20,
        startingAfter: payments[payments.length - 1].id,
        status: status === "all" ? undefined : status,
      });
      setPayments((prev) => [...prev, ...(data.payments || [])]);
      setHasMore(Boolean(data.hasMore));
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to load more payments.");
    }
  };

  const selectClass = "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500";

  return (
    <AdminPageShell title="Payments" description="Who paid, how much, for which plan, and what the payment/subscription status is.">
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          <SummaryCard icon={DollarSign} label="MRR" value={`AED ${summary.mrr.toFixed(2)}`} accent="bg-indigo-50 text-indigo-600" />
          <SummaryCard icon={TrendingUp} label="ARR" value={`AED ${summary.arr.toFixed(2)}`} accent="bg-violet-50 text-violet-600" />
          <SummaryCard icon={DollarSign} label="Revenue This Month" value={`${summary.revenueThisMonthCurrency} ${summary.revenueThisMonth.toFixed(2)}`} accent="bg-emerald-50 text-emerald-600" />
          <SummaryCard icon={CheckCircle2} label="Successful Payments (Month)" value={summary.successfulPaymentsThisMonth} accent="bg-emerald-50 text-emerald-600" />
          <SummaryCard icon={CheckCircle2} label="Active Subscriptions" value={summary.activeSubscriptions} accent="bg-indigo-50 text-indigo-600" />
          <SummaryCard icon={XCircle} label="Cancelled Subscriptions" value={summary.cancelledSubscriptions} accent="bg-red-50 text-red-600" />
          <SummaryCard icon={RotateCcw} label="Expired Subscriptions" value={summary.expiredSubscriptions} accent="bg-slate-100 text-slate-600" />
        </div>
      )}

      {!stripeConfigured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
          Stripe isn't configured in this environment — the payment table below can't be loaded, though subscription
          counts and MRR/ARR above (from local data) are still accurate.
        </div>
      )}

      <div className="flex justify-end">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="all">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-4 py-4 font-medium">Customer</th>
                <th className="px-4 py-4 font-medium">Company</th>
                <th className="px-4 py-4 font-medium">Account Type</th>
                <th className="px-4 py-4 font-medium">Amount</th>
                <th className="px-4 py-4 font-medium">Status</th>
                <th className="px-6 py-4 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500">Loading payments...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500">No payments found.</td></tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-6 py-4 text-slate-500">{p.date ? new Date(p.date).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-800">{p.customer?.name || "—"}</p>
                      <p className="text-xs text-slate-400">{p.customer?.email}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{p.company?.name || "—"}</td>
                    <td className="px-4 py-4 text-slate-700 capitalize">{p.accountType?.toLowerCase() || "—"}</td>
                    <td className="px-4 py-4 text-slate-700">{p.currency} {p.amount.toFixed(2)}</td>
                    <td className="px-4 py-4"><StatusBadge status={p.status} /></td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => setSelectedId(p.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-indigo-100 hover:text-indigo-700">
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && hasMore && (
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-center">
            <button onClick={loadMore} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Load More
            </button>
          </div>
        )}
      </div>

      <PaymentDetailModal paymentId={selectedId} onClose={() => setSelectedId(null)} />
    </AdminPageShell>
  );
}
