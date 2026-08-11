const subscriptionRepository = require("../repositories/subscriptionRepository");
const stripeService = require("./stripeService");

// Stripe subscription.status -> local subscriptions.status enum.
// The local enum predates Stripe and `getActiveSubscription` only ever
// treats 'active' as usable, so trialing/past_due both map to 'active' —
// the raw Stripe status is preserved separately in stripe_status for
// anything (future dunning UI, admin views) that needs the distinction.
// past_due -> active is a deliberate grace period: don't cut a customer's
// access on the first failed charge while Stripe is still retrying it.
const STRIPE_STATUS_MAP = {
  active: "active",
  trialing: "active",
  past_due: "active",
  canceled: "cancelled",
  unpaid: "cancelled",
  incomplete_expired: "cancelled"
  // "incomplete" is intentionally absent — no payment has succeeded yet,
  // so we don't create/update a local row for it at all.
};

class SubscriptionService {

  // =====================================================
  // Helpers
  // =====================================================

  addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  }

  addYears(date, years) {
    const d = new Date(date);
    d.setFullYear(d.getFullYear() + years);
    return d;
  }

  // =====================================================
  // Create Free Subscription
  // Called immediately after user registration
  // =====================================================

  async createFreeSubscription(userId) {

    // User already has active subscription?
    const active =
      await subscriptionRepository.getActiveSubscription(userId);

    if (active) {
      return active;
    }

    // Find Free plan
    const freePlan =
      await subscriptionRepository.getFreePlan();

    if (!freePlan) {
      throw new Error("Free plan not found.");
    }

    const today = new Date();

    const subscription = {

      user_id: userId,

      plan_id: freePlan.id,

      status: "active",

      billing_cycle: "monthly",

      price: freePlan.monthly_price,

      starts_at: today,

      expires_at: null,

      next_billing: null

    };

    const subscriptionId =
      await subscriptionRepository.createSubscription(subscription);

    // Keep users.plan synchronized
    await subscriptionRepository.updateUserPlan(
      userId,
      freePlan.slug
    );

    return await subscriptionRepository.getActiveSubscription(userId);
  }

  // =====================================================
  // Current Subscription
  // =====================================================

  async getCurrentSubscription(userId) {

    const subscription =
      await subscriptionRepository.getActiveSubscription(userId);

    if (!subscription) {
      throw new Error("No active subscription found.");
    }

    return subscription;

  }

    // =====================================================
  // Subscription History
  // =====================================================

  async getSubscriptionHistory(userId) {

    const history =
      await subscriptionRepository.getSubscriptionHistory(userId);

    return history;

  }

  // =====================================================
  // Validate Plan
  // =====================================================

  async validatePlan(planId) {

    const plan =
      await subscriptionRepository.getPlanById(planId);

    if (!plan) {
      throw new Error("Plan not found.");
    }

    if (!plan.active) {
      throw new Error("This plan is currently disabled.");
    }

    return plan;

  }

  // =====================================================
  // Validate Active Subscription
  // =====================================================

  async validateActiveSubscription(userId) {

    const subscription =
      await subscriptionRepository.getActiveSubscription(userId);

    if (!subscription) {
      throw new Error("Active subscription not found.");
    }

    return subscription;

  }

  // =====================================================
  // Calculate Billing Dates
  // =====================================================

  calculateBillingDates(billingCycle) {

    const startsAt = new Date();

    let expiresAt = null;
    let nextBilling = null;

    switch (billingCycle) {

      case "monthly":

        expiresAt = this.addMonths(startsAt, 1);

        nextBilling = this.addMonths(startsAt, 1);

        break;

      case "yearly":

        expiresAt = this.addYears(startsAt, 1);

        nextBilling = this.addYears(startsAt, 1);

        break;

      case "lifetime":

        expiresAt = null;

        nextBilling = null;

        break;

      default:

        throw new Error("Invalid billing cycle.");

    }

    return {

      startsAt,

      expiresAt,

      nextBilling

    };

  }

  // =====================================================
  // Build Subscription Object
  // =====================================================

  buildSubscription({

    userId,

    plan,

    billingCycle,

    startsAt,

    expiresAt,

    nextBilling

  }) {

    return {

      user_id: userId,

      plan_id: plan.id,

      status: "active",

      billing_cycle: billingCycle,

      price:
        billingCycle === "yearly"
          ? plan.yearly_price
          : plan.monthly_price,

      starts_at: startsAt,

      expires_at: expiresAt,

      next_billing: nextBilling

    };

  }
    // =====================================================
  // Change Plan
  // =====================================================

  async changePlan(userId, planId, billingCycle = "monthly") {

    // Get current active subscription
    const currentSubscription =
      await this.validateActiveSubscription(userId);

    // Get new plan
    const plan =
      await this.validatePlan(planId);

    // Prevent assigning the same plan again
    if (currentSubscription.plan_id === plan.id) {
      throw new Error(
        `Customer is already subscribed to ${plan.name}.`
      );
    }

    // Calculate billing dates
    const {
      startsAt,
      expiresAt,
      nextBilling
    } = this.calculateBillingDates(billingCycle);

    // Expire current subscription
    await subscriptionRepository.expireSubscription(
      currentSubscription.id
    );

    // Build new subscription
    const subscription =
      this.buildSubscription({

        userId,

        plan,

        billingCycle,

        startsAt,

        expiresAt,

        nextBilling

      });

    // Insert new subscription
    const subscriptionId =
      await subscriptionRepository.createSubscription(
        subscription
      );

    // Update users.plan
    await subscriptionRepository.updateUserPlan(
      userId,
      plan.slug
    );

    // Return latest subscription
    return await subscriptionRepository.getSubscriptionById(
      subscriptionId
    );

  }
    // =====================================================
  // Cancel Subscription
  // =====================================================

  async cancelSubscription(userId) {

    const subscription =
      await this.validateActiveSubscription(userId);

    // Stripe-backed subscriptions retain access until the paid period
    // actually ends — Stripe is the source of truth here, so we only flag
    // the intent to cancel and let the webhook (customer.subscription.
    // updated/deleted) perform the real downgrade to Free once Stripe
    // confirms the subscription has ended.
    if (subscription.stripe_subscription_id) {

      await stripeService.cancelAtPeriodEnd(
        subscription.stripe_subscription_id
      );

      await subscriptionRepository.setCancelAtPeriodEnd(
        subscription.id,
        true
      );

      return {
        success: true,
        message:
          "Your subscription will cancel at the end of the current billing period. You'll keep access until then.",
        subscription: await subscriptionRepository.getSubscriptionById(
          subscription.id
        )
      };

    }

    // No Stripe subscription behind this row (e.g. already on Free, or an
    // admin-comped plan) — keep the original immediate-cancel behavior.

    // Resolved before cancelling: if the Free plan is missing we must fail
    // without having already left the user with no active subscription.
    const freePlan =
      await subscriptionRepository.getFreePlan();

    if (!freePlan) {
      throw new Error("Free plan not found.");
    }

    await subscriptionRepository.cancelSubscription(
      subscription.id
    );

    // Free is the floor, so drop straight to it instead of leaving the user
    // with nothing active. Also resyncs users.plan, which cancelling alone
    // left pointing at the paid plan.
    const freeSubscription =
      await this.createFreeSubscription(userId);

    return {
      success: true,
      message:
        "Subscription cancelled successfully. You are now on the Free plan.",
      subscription: freeSubscription
    };

  }

  // =====================================================
  // Stripe — Customer
  // =====================================================

  async getOrCreateStripeCustomer(userId) {

    const user =
      await subscriptionRepository.getUserStripeInfo(userId);

    if (!user) {
      throw new Error("User not found.");
    }

    return await stripeService.getOrCreateCustomer(user);

  }

  // =====================================================
  // Stripe — Start Checkout (new subscription) or update an
  // existing Stripe subscription's price (upgrade/downgrade)
  // =====================================================

  async startCheckout(userId, planId, interval) {

    if (!["monthly", "yearly"].includes(interval)) {
      throw new Error("Invalid billing interval.");
    }

    const plan = await this.validatePlan(planId);

    if (plan.slug === "free") {
      throw new Error(
        "The Free plan doesn't require checkout — use select-plan instead."
      );
    }

    const priceId =
      interval === "yearly"
        ? plan.stripe_price_id_yearly
        : plan.stripe_price_id_monthly;

    if (!priceId) {
      throw new Error(
        `${plan.name} is not available on the ${interval} billing interval.`
      );
    }

    const current =
      await subscriptionRepository.getActiveSubscription(userId);

    const currentIsLiveStripeSub =
      current &&
      current.stripe_subscription_id &&
      (current.stripe_status === "active" ||
        current.stripe_status === "trialing");

    if (currentIsLiveStripeSub) {

      if (current.plan_id === plan.id && current.billing_cycle === interval) {
        throw new Error(
          `Customer is already subscribed to ${plan.name} (${interval}).`
        );
      }

      // Existing subscriber changing plans — update the live Stripe
      // subscription in place rather than starting a second one.
      const updated = await stripeService.updateSubscriptionPrice(
        current.stripe_subscription_id,
        priceId
      );

      const synced = await this.syncSubscriptionFromStripe(updated);

      return {
        updated: true,
        subscription: synced
      };

    }

    // No live Stripe subscription yet — start a fresh Checkout Session.
    const customer = await this.getOrCreateStripeCustomer(userId);

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    const session = await stripeService.createCheckoutSession({
      customerId: customer.id,
      priceId,
      userId,
      planId: plan.id,
      successUrl: `${frontendUrl}/dashboard/billing/return?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${frontendUrl}/price?checkout=cancelled`
    });

    return {
      updated: false,
      url: session.url
    };

  }

  // =====================================================
  // Stripe — Customer Portal
  // =====================================================

  async createPortalSession(userId) {

    const user =
      await subscriptionRepository.getUserStripeInfo(userId);

    if (!user || !user.stripe_customer_id) {
      throw new Error(
        "No billing account found. Subscribe to a paid plan first."
      );
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    const session = await stripeService.createPortalSession({
      customerId: user.stripe_customer_id,
      returnUrl: `${frontendUrl}/dashboard/usage`
    });

    return session.url;

  }

  // =====================================================
  // Stripe — Sync a Stripe Subscription object onto the local DB
  // (the only place that writes subscription state coming FROM Stripe;
  // called from the webhook handler, and immediately after in-place
  // updates so the UI reflects the change without waiting on the webhook)
  // =====================================================

  async syncSubscriptionFromStripe(stripeSubscription) {

    const localStatus = STRIPE_STATUS_MAP[stripeSubscription.status];

    // "incomplete" (first payment not yet confirmed) — nothing to persist.
    if (!localStatus) {
      return null;
    }

    const item = stripeSubscription.items.data[0];
    const priceId = item.price.id;

    const plan =
      await subscriptionRepository.getPlanByStripePriceId(priceId);

    if (!plan) {
      throw new Error(
        `No local plan is mapped to Stripe price ${priceId}.`
      );
    }

    let userId = stripeSubscription.metadata?.userId
      ? Number(stripeSubscription.metadata.userId)
      : null;

    if (!userId) {
      const user = await subscriptionRepository.findUserByStripeCustomerId(
        stripeSubscription.customer
      );

      if (!user) {
        throw new Error(
          `No local user found for Stripe customer ${stripeSubscription.customer}.`
        );
      }

      userId = user.id;
    }

    const billingCycle =
      priceId === plan.stripe_price_id_yearly ? "yearly" : "monthly";

    const price =
      billingCycle === "yearly" ? plan.yearly_price : plan.monthly_price;

    const toDate = (unixSeconds) =>
      unixSeconds ? new Date(unixSeconds * 1000) : null;

    // current_period_end has moved onto the subscription item in newer
    // Stripe API versions — fall back to the subscription-level field for
    // older accounts/API versions.
    const periodEnd =
      item.current_period_end ?? stripeSubscription.current_period_end;

    const subscription = await subscriptionRepository.upsertStripeSubscription({
      userId,
      planId: plan.id,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: stripeSubscription.customer,
      stripePriceId: priceId,
      status: localStatus,
      stripeStatus: stripeSubscription.status,
      billingCycle,
      price,
      startsAt: toDate(stripeSubscription.start_date) || new Date(),
      expiresAt: toDate(periodEnd),
      nextBilling: toDate(periodEnd),
      cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end)
    });

    if (localStatus === "active") {
      await subscriptionRepository.updateUserPlan(userId, plan.slug);
    } else {
      // Terminal Stripe state — Free is the floor, same fallback the
      // manual-cancel flow uses.
      await this.createFreeSubscription(userId);
    }

    return subscription;

  }

  // =====================================================
  // Renew Subscription
  // =====================================================

  async renewSubscription(userId) {

    const subscription =
      await this.validateActiveSubscription(userId);

    let expiresAt;
    let nextBilling;

    if (subscription.billing_cycle === "monthly") {

      expiresAt = this.addMonths(
        subscription.expires_at || new Date(),
        1
      );

      nextBilling = expiresAt;

    } else if (subscription.billing_cycle === "yearly") {

      expiresAt = this.addYears(
        subscription.expires_at || new Date(),
        1
      );

      nextBilling = expiresAt;

    } else {

      return subscription;

    }

    await subscriptionRepository.renewSubscription(
      subscription.id,
      expiresAt,
      nextBilling
    );

    return await subscriptionRepository.getSubscriptionById(
      subscription.id
    );

  }

  // =====================================================
  // Invoice Limit
  // =====================================================

  async checkInvoiceLimit(userId) {

    const subscription =
      await this.getCurrentSubscription(userId);

    const used =
      await subscriptionRepository.getInvoiceCount(userId);

    return {

      used,

      limit: subscription.invoice_limit,

      remaining:
        subscription.invoice_limit - used,

      allowed:
        used < subscription.invoice_limit

    };

  }

  // =====================================================
  // Client Limit
  // =====================================================

  async checkClientLimit(userId) {

    const subscription =
      await this.getCurrentSubscription(userId);

    const used =
      await subscriptionRepository.getClientCount(userId);

    return {

      used,

      limit: subscription.client_limit,

      remaining:
        subscription.client_limit - used,

      allowed:
        used < subscription.client_limit

    };

  }

  // =====================================================
  // Storage Limit
  // =====================================================

  async checkStorageLimit(userId) {

    const subscription =
      await this.getCurrentSubscription(userId);

    const used =
      await subscriptionRepository.getStorageUsed(userId);

    return {

      used,

      limit: subscription.storage_limit,

      remaining:
        subscription.storage_limit - used,

      allowed:
        used < subscription.storage_limit

    };

  }

  // =====================================================
  // OCR Limit
  // =====================================================

  async checkOCRLimit(userId) {

    const subscription =
      await this.getCurrentSubscription(userId);

    const used =
      await subscriptionRepository.getOCRUsed(userId);

    return {

      used,

      limit: subscription.ocr_limit,

      remaining:
        subscription.ocr_limit - used,

      allowed:
        used < subscription.ocr_limit

    };

  }

}

module.exports = new SubscriptionService();
