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
    planId,
    successUrl,
    cancelUrl
  }) {

    try {

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
        metadata: {
          userId: String(userId),
          planId: String(planId)
        },
        subscription_data: {
          metadata: {
            userId: String(userId),
            planId: String(planId)
          }
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

}

module.exports = new StripeService();
