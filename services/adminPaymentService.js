const stripeService = require("./stripeService");
const subscriptionService = require("./subscriptionService");
const adminRepository = require("../repositories/adminRepository");
const adminPaymentRepository = require("../repositories/adminPaymentRepository");

function startOfMonth() {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
}

// App-level status -> the closest real Stripe invoice.status. Stripe has
// no "refunded" invoice status (a paid invoice stays "paid" after a later
// refund — see subscriptionService.invoicePaymentStatus's own note), so
// that filter value intentionally has no Stripe-side mapping and is
// ignored rather than faked.
const STATUS_TO_STRIPE = {
  paid: "paid",
  pending: "open",
  failed: "uncollectible",
  cancelled: "void",
};

function formatPayment(invoice, usersByStripeId) {
  const user = usersByStripeId.get(invoice.customer);

  return {
    id: invoice.id,
    date: invoice.created ? new Date(invoice.created * 1000) : null,
    customer: user ? { name: user.name, email: user.email } : null,
    company: user?.company_id ? { id: user.company_id, name: user.company_name } : null,
    accountType: user?.account_type || null,
    amount: (invoice.amount_paid ?? invoice.total ?? 0) / 100,
    currency: (invoice.currency || "aed").toUpperCase(),
    status: subscriptionService.invoicePaymentStatus(invoice),
    paymentMethod: subscriptionService.invoicePaymentMethod(invoice),
    hostedInvoiceUrl: invoice.hosted_invoice_url || null,
    invoicePdf: invoice.invoice_pdf || null,
  };
}

class AdminPaymentService {
  async getSummary() {
    const platform = await adminRepository.getPlatformStats();
    const subs = await adminPaymentRepository.getSubscriptionCounts();

    // "Revenue This Month" is a bounded live Stripe read (paid invoices
    // created since the 1st of this month, capped at 500) — accurate and
    // cheap because the date filter keeps it small. An all-time "Total
    // Revenue" would mean paginating Stripe's entire invoice history on
    // every page load, which doesn't scale — omitted rather than faked or
    // built slow; MRR/ARR (both exact, from local subscription data)
    // cover the recurring-revenue answer instead.
    let revenueThisMonth = { total: 0, count: 0, currency: "AED" };
    let stripeConfigured = true;

    try {
      revenueThisMonth = await this.sumPaidInvoicesSince(startOfMonth());
    } catch (err) {
      // Stripe not configured in this environment (no live keys) — the
      // rest of the Payments module still works off local subscription
      // data, this just can't show live payment figures.
      stripeConfigured = false;
    }

    return {
      stripeConfigured,
      mrr: platform.monthlyRevenue,
      arr: platform.monthlyRevenue * 12,
      revenueThisMonth: revenueThisMonth.total,
      revenueThisMonthCurrency: revenueThisMonth.currency,
      successfulPaymentsThisMonth: revenueThisMonth.count,
      activeSubscriptions: subs.active,
      cancelledSubscriptions: subs.cancelled,
      expiredSubscriptions: subs.expired,
      monthlySubscriptions: subs.monthly,
      yearlySubscriptions: subs.yearly,
    };
  }

  async sumPaidInvoicesSince(sinceUnixSeconds, hardCap = 500) {
    let total = 0;
    let count = 0;
    let currency = "aed";
    let startingAfter;
    let fetched = 0;

    while (fetched < hardCap) {
      const result = await stripeService.listAllInvoices({
        limit: 100,
        startingAfter,
        status: "paid",
      });

      const inRange = result.data.filter((inv) => inv.created >= sinceUnixSeconds);

      for (const inv of inRange) {
        total += (inv.amount_paid || 0) / 100;
        count += 1;
        currency = (inv.currency || currency).toUpperCase();
      }

      fetched += result.data.length;

      // Stripe returns newest-first — once a page's invoices are all
      // older than the cutoff, every subsequent page will be too.
      if (inRange.length < result.data.length || !result.has_more) break;

      startingAfter = result.data[result.data.length - 1].id;
    }

    return { total, count, currency: currency.toUpperCase() };
  }

  // Live Stripe read, cursor-paginated exactly like the customer-facing
  // Billing & Payments page's getPaymentHistory — never loads "all"
  // payments into memory, and Stripe (not a local table) stays the
  // source of truth.
  async getPayments({ limit = 20, startingAfter, status } = {}) {
    const stripeStatus = status ? STATUS_TO_STRIPE[status] : undefined;

    let result;

    try {
      result = await stripeService.listAllInvoices({
        limit,
        startingAfter,
        status: stripeStatus,
      });
    } catch (err) {
      return { payments: [], hasMore: false, stripeConfigured: false };
    }

    const customerIds = [...new Set(result.data.map((inv) => inv.customer).filter(Boolean))];
    const users = await adminPaymentRepository.getUsersByStripeCustomerIds(customerIds);
    const usersByStripeId = new Map(users.map((u) => [u.stripe_customer_id, u]));

    return {
      payments: result.data.map((invoice) => formatPayment(invoice, usersByStripeId)),
      hasMore: result.has_more,
      stripeConfigured: true,
    };
  }

  async getPaymentDetail(invoiceId) {
    const invoice = await stripeService.getInvoice(invoiceId);

    if (!invoice) {
      throw new Error("Payment not found.");
    }

    const users = await adminPaymentRepository.getUsersByStripeCustomerIds([invoice.customer]);
    const usersByStripeId = new Map(users.map((u) => [u.stripe_customer_id, u]));
    const summary = formatPayment(invoice, usersByStripeId);

    return {
      ...summary,
      subtotal: (invoice.subtotal ?? 0) / 100,
      tax: (invoice.tax ?? 0) / 100,
      total: (invoice.total ?? 0) / 100,
      // Advanced/technical section — Stripe identifiers only, never
      // card numbers/secrets (those never reach our server at all).
      stripeInvoiceId: invoice.id,
      stripeCustomerId: invoice.customer,
      stripeSubscriptionId: invoice.subscription || null,
    };
  }
}

module.exports = new AdminPaymentService();
