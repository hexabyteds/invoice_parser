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