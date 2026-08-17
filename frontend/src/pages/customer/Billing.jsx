import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Sparkles,
  ArrowUpRight,
  RotateCcw,
  Clock,
  CreditCard,
  Receipt,
  Wallet,
  CalendarClock,
  Loader2,
  AlertCircle,
  Download,
  ExternalLink,
  X,
} from "lucide-react";

import subscriptionApi from "../../services/subscriptionApi";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { formatDateDisplay } from "../../utils/formatDate";

const PAGE_SIZE = 10;

const STATUS_BADGE = {
  paid: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-purple-100 text-purple-700",
  canceled: "bg-slate-100 text-slate-600",
};

function money(amount, currency) {
  const value = Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency || "AED"} ${value}`;
}

function StatusBadge({ status }) {
  const cls = STATUS_BADGE[status] || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold capitalize ${cls}`}>
      {status || "-"}
    </span>
  );
}

export default function Billing() {
  const [subscription, setSubscription] = useState(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState("");

  const [payments, setPayments] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paymentsError, setPaymentsError] = useState("");

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [resuming, setResuming] = useState(false);

  const [detailInvoice, setDetailInvoice] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailOpenId, setDetailOpenId] = useState(null);

  useEffect(() => {
    loadSubscription();
    loadPayments();
  }, []);

  async function loadSubscription() {
    try {
      setLoadingSubscription(true);
      setSubscriptionError("");
      const res = await subscriptionApi.getCurrent();
      setSubscription(res.data.subscription);
    } catch (err) {
      setSubscriptionError(
        err.response?.data?.error || "Unable to load your subscription."
      );
    } finally {
      setLoadingSubscription(false);
    }
  }

  async function loadPayments() {
    try {
      setLoadingPayments(true);
      setPaymentsError("");
      const res = await subscriptionApi.getPayments({ limit: PAGE_SIZE });
      setPayments(res.data.payments || []);
      setHasMore(Boolean(res.data.hasMore));
    } catch (err) {
      setPaymentsError(
        err.response?.data?.error || "Unable to load payment history."
      );
    } finally {
      setLoadingPayments(false);
    }
  }

  async function loadMorePayments() {
    if (!payments.length) return;

    try {
      setLoadingMore(true);
      const startingAfter = payments[payments.length - 1].id;
      const res = await subscriptionApi.getPayments({
        limit: PAGE_SIZE,
        startingAfter,
      });
      setPayments((prev) => [...prev, ...(res.data.payments || [])]);
      setHasMore(Boolean(res.data.hasMore));
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Unable to load more payments."
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function confirmCancel() {
    const isStripeBacked = Boolean(subscription?.stripe_subscription_id);

    try {
      setCancelling(true);
      await subscriptionApi.cancel();
      toast.success(
        isStripeBacked
          ? "Your subscription will end at the close of the current billing period. You'll keep full access until then."
          : "Subscription cancelled — you're back on the Free plan."
      );
      await loadSubscription();
    } catch (err) {
      toast.error(err.response?.data?.error || "Unable to cancel subscription.");
    } finally {
      setCancelling(false);
      setCancelOpen(false);
    }
  }

  async function confirmResume() {
    try {
      setResuming(true);
      await subscriptionApi.resume();
      toast.success("Your subscription has been resumed.");
      await loadSubscription();
    } catch (err) {
      toast.error(err.response?.data?.error || "Unable to resume subscription.");
    } finally {
      setResuming(false);
    }
  }

  async function openInvoiceDetail(invoiceId) {
    setDetailOpenId(invoiceId);
    setDetailInvoice(null);
    setDetailError("");
    setDetailLoading(true);

    try {
      const res = await subscriptionApi.getPaymentDetail(invoiceId);
      setDetailInvoice(res.data.invoice);
    } catch (err) {
      setDetailError(
        err.response?.data?.error || "Unable to load invoice details."
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function closeInvoiceDetail() {
    setDetailOpenId(null);
    setDetailInvoice(null);
    setDetailError("");
  }

  // Best-effort summary derived from whatever payment history is currently
  // loaded — Stripe has no cheap "lifetime total" endpoint, so this
  // reflects the invoices fetched so far rather than a guaranteed
  // all-time figure once there are more pages than currently loaded.
  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const lastPayment = payments.find((p) => p.status === "paid");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 font-display tracking-tight">
          Billing &amp; Payments
        </h1>
        <p className="mt-2 text-slate-500">
          Manage your subscription, billing information, and payment history.
        </p>
      </div>

      {/* Current Plan */}
      {loadingSubscription ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
          <p className="mt-4 font-medium text-slate-700">Loading subscription...</p>
        </div>
      ) : subscriptionError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
          {subscriptionError}
        </div>
      ) : subscription ? (
        <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-6 shadow-lg sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-indigo-100">
                <Sparkles size={16} />
                <span className="text-sm font-medium">Current Plan</span>
              </div>

              <h2 className="text-3xl font-bold text-white sm:text-4xl">
                {subscription.name}
              </h2>

              <p className="mt-2 text-lg text-indigo-100">
                {money(subscription.price, "AED")}
                <span className="text-sm"> / {subscription.billing_cycle || "month"}</span>
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {subscription.cancel_at_period_end ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-100">
                    <Clock size={12} />
                    Canceling
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white capitalize">
                    {subscription.status}
                  </span>
                )}
              </div>

              {subscription.cancel_at_period_end ? (
                <p className="mt-4 max-w-md rounded-xl bg-black/15 p-3 text-sm text-indigo-50">
                  Your subscription will not renew after{" "}
                  <strong>{formatDateDisplay(subscription.expires_at)}</strong>.
                  You can continue using your current plan until then.
                </p>
              ) : (
                <p className="mt-4 text-sm text-indigo-100">
                  Next billing: {formatDateDisplay(subscription.next_billing)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:items-end">
              <Link
                to="/price"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
              >
                Upgrade Plan
                <ArrowUpRight size={16} />
              </Link>

              {subscription.cancel_at_period_end ? (
                <button
                  onClick={confirmResume}
                  disabled={resuming}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw size={16} />
                  {resuming ? "Resuming..." : "Resume Plan"}
                </button>
              ) : (
                subscription.slug !== "free" && (
                  <button
                    onClick={() => setCancelOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Cancel Plan
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Billing Summary */}
      {subscription && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={<CreditCard size={18} />}
            label="Billing Cycle"
            value={subscription.billing_cycle || "-"}
          />
          <SummaryCard
            icon={<Wallet size={18} />}
            label="Current Price"
            value={money(subscription.price, "AED")}
          />
          <SummaryCard
            icon={<Receipt size={18} />}
            label={lastPayment ? "Last Payment" : "Total Paid"}
            value={
              lastPayment
                ? money(lastPayment.amount, lastPayment.currency)
                : money(totalPaid, "AED")
            }
          />
          <SummaryCard
            icon={<CalendarClock size={18} />}
            label={subscription.cancel_at_period_end ? "Access Until" : "Next Billing"}
            value={formatDateDisplay(
              subscription.cancel_at_period_end
                ? subscription.expires_at
                : subscription.next_billing
            )}
          />
        </div>
      )}

      {/* Payment History */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Payment History</h2>

        {loadingPayments ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <Loader2 size={32} className="animate-spin text-indigo-600" />
            <p className="mt-4 text-slate-500">Loading payment history...</p>
          </div>
        ) : paymentsError ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <AlertCircle size={40} className="text-red-500" />
            <p className="mt-3 text-slate-700 font-medium">Couldn't load payment history</p>
            <p className="mt-1 text-sm text-slate-500">{paymentsError}</p>
            <button
              onClick={loadPayments}
              className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold transition-all"
            >
              Retry
            </button>
          </div>
        ) : payments.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <Receipt size={40} className="text-slate-300" />
            <p className="mt-3 text-slate-700 font-medium">No payment history yet</p>
            <p className="mt-1 text-sm text-slate-500">
              You don't have any completed payments yet.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-6">
              <table className="min-w-full">
                <thead className="bg-slate-50 border-y">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Billing Period</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b hover:bg-slate-50 transition">
                      <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                        {formatDateDisplay(payment.date)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 whitespace-nowrap">
                        {payment.plan || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                        {payment.periodStart && payment.periodEnd
                          ? `${formatDateDisplay(payment.periodStart)} – ${formatDateDisplay(payment.periodEnd)}`
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900 text-right whitespace-nowrap">
                        {money(payment.amount, payment.currency)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={payment.status} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => openInvoiceDetail(payment.id)}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="mt-5 flex justify-center">
                <button
                  onClick={loadMorePayments}
                  disabled={loadingMore}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition"
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel subscription?"
        message={
          subscription?.stripe_subscription_id
            ? `Your subscription will remain active until ${formatDateDisplay(
                subscription.expires_at
              )}. You will not be charged again after that date.`
            : "You'll be moved back to the Free plan immediately. This cannot be undone."
        }
        confirmLabel="Cancel Subscription"
        cancelLabel="Keep Plan"
        loadingLabel="Cancelling..."
        loading={cancelling}
        onConfirm={confirmCancel}
        onCancel={() => setCancelOpen(false)}
      />

      {detailOpenId && (
        <InvoiceDetailModal
          loading={detailLoading}
          error={detailError}
          invoice={detailInvoice}
          onClose={closeInvoiceDetail}
        />
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className="bg-white rounded-2xl border p-5">
      <div className="flex items-center gap-2 text-slate-500">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          {icon}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-3 text-xl font-bold text-slate-900 capitalize">{value}</p>
    </div>
  );
}

function InvoiceDetailModal({ loading, error, invoice, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Invoice Details</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="py-10 flex flex-col items-center justify-center">
              <Loader2 size={28} className="animate-spin text-indigo-600" />
              <p className="mt-3 text-sm text-slate-500">Loading invoice...</p>
            </div>
          ) : error ? (
            <div className="py-6 text-center">
              <AlertCircle size={32} className="mx-auto text-red-500" />
              <p className="mt-3 text-sm text-red-600">{error}</p>
            </div>
          ) : invoice ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Invoice Number</span>
                <span className="text-sm font-semibold text-slate-900">
                  {invoice.number || invoice.stripeInvoiceId}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Status</span>
                <StatusBadge status={invoice.status} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Date</span>
                <span className="text-sm font-medium text-slate-900">
                  {formatDateDisplay(invoice.date)}
                </span>
              </div>

              <div className="border-t pt-4 space-y-2">
                <DetailRow label="Customer" value={invoice.customerName} />
                <DetailRow label="Email" value={invoice.customerEmail} />
                <DetailRow label="Plan" value={invoice.plan} />
                <DetailRow
                  label="Billing Period"
                  value={
                    invoice.periodStart && invoice.periodEnd
                      ? `${formatDateDisplay(invoice.periodStart)} – ${formatDateDisplay(invoice.periodEnd)}`
                      : "-"
                  }
                />
                <DetailRow label="Payment Method" value={invoice.paymentMethod || "-"} />
              </div>

              <div className="border-t pt-4 space-y-2">
                <DetailRow label="Subtotal" value={money(invoice.subtotal, invoice.currency)} />
                <DetailRow label="Tax / VAT" value={money(invoice.tax, invoice.currency)} />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">Total</span>
                  <span className="text-base font-bold text-slate-900">
                    {money(invoice.total, invoice.currency)}
                  </span>
                </div>
              </div>

              {(invoice.invoicePdf || invoice.hostedInvoiceUrl) && (
                <a
                  href={invoice.invoicePdf || invoice.hostedInvoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-5 py-3 text-sm font-semibold text-white transition-all"
                >
                  {invoice.invoicePdf ? <Download size={16} /> : <ExternalLink size={16} />}
                  {invoice.invoicePdf ? "Download PDF" : "View on Stripe"}
                </a>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value || "-"}</span>
    </div>
  );
}
