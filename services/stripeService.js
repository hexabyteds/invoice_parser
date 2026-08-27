const stripe = require("../config/stripe");
const subscriptionRepository = require("../repositories/subscriptionRepository");

// Stripe SDK errors (StripeAuthenticationError, StripeInvalidRequestError,
// StripeAPIError, StripeConnectionError, StripeRateLimitError, ...) can
// carry internal details (key prefixes, request ids, raw API messages) that
// must never reach the customer verbatim — logged server-side instead, and
// replaced with one generic, safe message.
function normalizeStripeError(err, context) {

  if (err.type && String(err.type).startsWith("Stripe")) {

    console.error(`Stripe API error during ${context}:`, err);

    throw new Error(
      "We couldn't complete that billing request. Please try again in a moment or contact support."
    );

  }

  throw err;

}

class StripeService {

  // =====================================================
  // Customer
  // =====================================================

  async getOrCreateCustomer(user) {

    try {

      if (user.stripe_customer_id) {

        const existing =
          await stripe.customers.retrieve(user.stripe_customer_id);

        if (!existing.deleted) {
          return existing;
        }
        // Falls through to create a new one if Stripe shows it deleted.
      }

      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: String(user.id)
        }
      });

      await subscriptionRepository.setStripeCustomerId(user.id, customer.id);

      return customer;

    } catch (err) {
      normalizeStripeError(err, "getOrCreateCustomer");
    }

  }

  // =====================================================
  // Checkout Session (new subscription)
  // =====================================================

  async createCheckoutSession({
    customerId,
    priceId,
    userId,
    companyId,
    billingScope = "company",
    planId,
    successUrl,
    cancelUrl
  }) {

    try {

      const metadata = {
        userId: String(userId),
        companyId: companyId != null ? String(companyId) : "",
        billingScope,
        planId: String(planId)
      };

      return await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [
          {
            price: priceId,
            quantity: 1
          }
        ],
        client_reference_id: String(userId),
        metadata,
        subscription_data: {
          metadata
        },
        success_url: successUrl,
        cancel_url: cancelUrl
      });

    } catch (err) {
      normalizeStripeError(err, "createCheckoutSession");
    }

  }

  // =====================================================
  // Customer Portal
  // =====================================================

  async createPortalSession({ customerId, returnUrl }) {

    try {

      return await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl
      });

    } catch (err) {
      normalizeStripeError(err, "createPortalSession");
    }

  }

  // =====================================================
  // Upgrade / Downgrade an existing subscription
  // =====================================================

  async updateSubscriptionPrice(stripeSubscriptionId, newPriceId) {

    try {

      const subscription =
        await stripe.subscriptions.retrieve(stripeSubscriptionId);

      const itemId = subscription.items.data[0].id;

      return await stripe.subscriptions.update(stripeSubscriptionId, {
        items: [
          {
            id: itemId,
            price: newPriceId
          }
        ],
        proration_behavior: "create_prorations"
      });

    } catch (err) {
      normalizeStripeError(err, "updateSubscriptionPrice");
    }

  }

  // =====================================================
  // Cancellation (retains access until period end)
  // =====================================================

  async cancelAtPeriodEnd(stripeSubscriptionId) {

    try {

      return await stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true
      });

    } catch (err) {
      normalizeStripeError(err, "cancelAtPeriodEnd");
    }

  }

  // =====================================================
  // Resume (undo a pending cancel_at_period_end)
  // =====================================================

  async resumeSubscription(stripeSubscriptionId) {

    try {

      return await stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: false
      });

    } catch (err) {
      normalizeStripeError(err, "resumeSubscription");
    }

  }

  // =====================================================
  // Payment History (Stripe is the source of truth — nothing about past
  // invoices is duplicated locally, this is always a live read)
  // =====================================================

  async listInvoices({ customerId, limit = 10, startingAfter }) {

    try {

      return await stripe.invoices.list({
        customer: customerId,
        limit,
        starting_after: startingAfter || undefined
      });

    } catch (err) {
      normalizeStripeError(err, "listInvoices");
    }

  }

  // Platform-wide invoice list (no customer filter) — for the Super Admin
  // Payments module. Same Stripe API, same account, just unscoped; Stripe
  // remains the sole source of truth, nothing about this is duplicated
  // into a local payments table.
  async listAllInvoices({ limit = 20, startingAfter, status } = {}) {

    try {

      return await stripe.invoices.list({
        limit,
        starting_after: startingAfter || undefined,
        status: status && status !== "all" ? status : undefined
      });

    } catch (err) {
      normalizeStripeError(err, "listAllInvoices");
    }

  }

  async getInvoice(invoiceId) {

    try {

      // Invoices on this account's pinned API version (Stripe.API_VERSION,
      // see config/stripe.js) no longer carry `charge`/`payment_intent` —
      // payment-method detail, when set, lives on `default_payment_method`.
      return await stripe.invoices.retrieve(invoiceId, {
        expand: ["default_payment_method"]
      });

    } catch (err) {
      normalizeStripeError(err, "getInvoice");
    }

  }

}

module.exports = new StripeService();
