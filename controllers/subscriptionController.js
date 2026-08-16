const subscriptionService = require("../services/subscriptionService");

class SubscriptionController {

  // =====================================================
  // Current Subscription
  // =====================================================

  async getCurrentSubscription(req, res) {

    try {

      const subscription =
        await subscriptionService.getCurrentSubscription(
          req.user.id
        );

      res.json({
        success: true,
        subscription
      });

    } catch (err) {

      res.status(400).json({
        success: false,
        error: err.message
      });

    }

  }

  // =====================================================
  // Subscription History
  // =====================================================

  async getSubscriptionHistory(req, res) {

    try {

      const history =
        await subscriptionService.getSubscriptionHistory(
          req.user.id
        );

      res.json({
        success: true,
        history
      });

    } catch (err) {

      res.status(400).json({
        success: false,
        error: err.message
      });

    }

  }

  // =====================================================
  // Change Plan
  // =====================================================

  async changePlan(req, res) {

    try {

      const {

        userId,

        planId,

        billingCycle

      } = req.body;

      const subscription =
        await subscriptionService.changePlan(

          userId,

          planId,

          billingCycle

        );

      res.json({

        success: true,

        message: "Subscription updated successfully.",

        subscription

      });

    } catch (err) {

      res.status(400).json({

        success: false,

        error: err.message

      });

    }

  }

  // =====================================================
  // Select Plan (customer self-service — always the caller's own
  // subscription, unlike changePlan above which is admin-only and takes
  // an arbitrary target userId from the request body)
  // =====================================================

  async selectPlan(req, res) {

    try {

      const { planId, billingCycle } = req.body;

      // Paid plans must go through Stripe Checkout (POST /checkout) so
      // payment is actually collected — this self-service endpoint predates
      // Stripe and would otherwise let a customer grant themselves a paid
      // plan for free. Only the Free plan can still be self-assigned here.
      const plan = await subscriptionService.validatePlan(planId);

      if (Number(plan.monthly_price) > 0 || Number(plan.yearly_price) > 0) {
        return res.status(400).json({
          success: false,
          error:
            "Paid plans require checkout. Use POST /api/subscriptions/checkout instead."
        });
      }

      const subscription =
        await subscriptionService.changePlan(
          req.user.id,
          planId,
          billingCycle
        );

      res.json({
        success: true,
        message: "Plan updated successfully.",
        subscription
      });

    } catch (err) {

      res.status(400).json({
        success: false,
        error: err.message
      });

    }

  }

  // =====================================================
  // Stripe Checkout (new subscription or plan change for an
  // existing Stripe subscriber)
  // =====================================================

  async checkout(req, res) {

    try {

      const { planId, interval } = req.body;

      const result = await subscriptionService.startCheckout(
        req.user.id,
        planId,
        interval
      );

      res.json({
        success: true,
        ...result
      });

    } catch (err) {

      res.status(400).json({
        success: false,
        error: err.message
      });

    }

  }

  // =====================================================
  // Stripe Customer Portal
  // =====================================================

  async portal(req, res) {

    try {

      const url = await subscriptionService.createPortalSession(req.user.id);

      res.json({
        success: true,
        url
      });

    } catch (err) {

      res.status(400).json({
        success: false,
        error: err.message
      });

    }

  }

  // =====================================================
  // Cancel Subscription
  // =====================================================

  async cancelSubscription(req, res) {

    try {

      const result =
        await subscriptionService.cancelSubscription(
          req.user.id
        );

      res.json({

        success: true,

        message: result.message,

        subscription: result.subscription

      });

    } catch (err) {

      res.status(400).json({

        success: false,

        error: err.message

      });

    }

  }

  // =====================================================
  // Renew Subscription
  // =====================================================

  async renewSubscription(req, res) {

    try {

      const subscription =
        await subscriptionService.renewSubscription(
          req.user.id
        );

      res.json({

        success: true,

        subscription

      });

    } catch (err) {

      res.status(400).json({

        success: false,

        error: err.message

      });

    }

  }

  // =====================================================
  // Payment History (Billing & Payments page)
  // =====================================================

  async getPaymentHistory(req, res) {

    try {

      const { limit, startingAfter } = req.query;

      const result =
        await subscriptionService.getPaymentHistory(req.user.id, {
          limit: limit ? Number(limit) : undefined,
          startingAfter: startingAfter || undefined
        });

      res.json({
        success: true,
        ...result
      });

    } catch (err) {

      res.status(400).json({
        success: false,
        error: err.message
      });

    }

  }

  async getPaymentDetail(req, res) {

    try {

      const invoice =
        await subscriptionService.getPaymentDetail(
          req.user.id,
          req.params.invoiceId
        );

      res.json({
        success: true,
        invoice
      });

    } catch (err) {

      res.status(400).json({
        success: false,
        error: err.message
      });

    }

  }

  // =====================================================
  // Usage
  // =====================================================

  async getUsage(req, res) {

    try {

      const invoice =
        await subscriptionService.checkInvoiceLimit(
          req.user.id
        );

      const client =
        await subscriptionService.checkClientLimit(
          req.user.id
        );

      const storage =
        await subscriptionService.checkStorageLimit(
          req.user.id
        );

      const ocr =
        await subscriptionService.checkOCRLimit(
          req.user.id
        );

      res.json({

        success: true,

        usage: {

          invoices: invoice,

          clients: client,

          storage,

          ocr

        }

      });

    } catch (err) {

      res.status(400).json({

        success: false,

        error: err.message

      });

    }

  }

}

module.exports = new SubscriptionController();