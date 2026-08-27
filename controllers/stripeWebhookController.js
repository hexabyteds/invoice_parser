const stripe = require("../config/stripe");
const subscriptionRepository = require("../repositories/subscriptionRepository");
const subscriptionService = require("../services/subscriptionService");
const auditLogRepository = require("../repositories/auditLogRepository");

class StripeWebhookController {

  async handleWebhook(req, res) {

    const signature = req.headers["stripe-signature"];

    let event;

    try {

      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

    } catch (err) {

      console.error("Stripe webhook signature verification failed:", err.message);

      return res.status(400).json({
        success: false,
        error: "Invalid webhook signature."
      });

    }

    // Atomic idempotency claim via the table's unique key — if another
    // delivery of the same event already claimed it, skip processing but
    // still ack 200 so Stripe stops retrying.
    const claimed = await subscriptionRepository.markWebhookEventProcessed(
      event.id,
      event.type
    );

    if (!claimed) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    try {

      await this.dispatch(event);

      return res.status(200).json({ received: true });

    } catch (err) {

      console.error(`Stripe webhook handling failed for ${event.type}:`, err);

      // Release the idempotency claim so Stripe's retry can actually
      // reprocess this event instead of it being silently dropped.
      await subscriptionRepository.unmarkWebhookEventProcessed(event.id);

      return res.status(500).json({
        success: false,
        error: "Webhook handling failed."
      });

    }

  }

  async dispatch(event) {

    switch (event.type) {

      case "checkout.session.completed": {

        const session = event.data.object;

        if (session.mode === "subscription" && session.subscription) {

          const subscription = await stripe.subscriptions.retrieve(
            session.subscription
          );

          await subscriptionService.syncSubscriptionFromStripe(subscription);

        }

        break;

      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {

        await subscriptionService.syncSubscriptionFromStripe(event.data.object);

        break;

      }

      case "invoice.paid": {

        const invoice = event.data.object;

        if (invoice.subscription) {

          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription
          );

          await subscriptionService.syncSubscriptionFromStripe(subscription);
          await this.logPaymentEvent(subscription, {
            action: "payment_succeeded",
            status: "SUCCESS",
            description: `Payment received (${((invoice.amount_paid || 0) / 100).toFixed(2)} ${(invoice.currency || "").toUpperCase()})`,
          });

        }

        break;

      }

      case "invoice.payment_failed": {

        const invoice = event.data.object;

        if (invoice.subscription) {

          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription
          );

          await subscriptionService.syncSubscriptionFromStripe(subscription);
          await this.logPaymentEvent(subscription, {
            action: "payment_failed",
            status: "FAILED",
            description: `Payment failed (${((invoice.amount_due || 0) / 100).toFixed(2)} ${(invoice.currency || "").toUpperCase()})`,
          });

        }

        break;

      }

      default:
        // No-op for event types we don't act on — still acked 200 above.
        break;

    }

  }

  // Best-effort — resolves the userId/companyId the same way
  // syncSubscriptionFromStripe does (metadata first, owned-company
  // fallback) so payment audit events land against the right actor
  // without a second Stripe round trip.
  async logPaymentEvent(stripeSubscription, { action, status, description }) {

    try {

      let userId = stripeSubscription.metadata?.userId
        ? Number(stripeSubscription.metadata.userId)
        : null;

      if (!userId) {
        const user = await subscriptionRepository.findUserByStripeCustomerId(
          stripeSubscription.customer
        );
        userId = user?.id || null;
      }

      const companyId = stripeSubscription.metadata?.companyId
        ? Number(stripeSubscription.metadata.companyId)
        : null;

      await auditLogRepository.create({
        userId,
        companyId,
        action,
        module: "Billing",
        status,
        description,
      });

    } catch (logErr) {}

  }

}

module.exports = new StripeWebhookController();
