const subscriptionRepository = require("../repositories/subscriptionRepository");

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
