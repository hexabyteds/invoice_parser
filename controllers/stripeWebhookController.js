const stripe = require("../config/stripe");
const subscriptionRepository = require("../repositories/subscriptionRepository");
const subscriptionService = require("../services/subscriptionService");

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

        }

        break;

      }

      default:
        // No-op for event types we don't act on — still acked 200 above.
        break;

    }

  }

}

module.exports = new StripeWebhookController();
