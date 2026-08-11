const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");

const subscriptionController = require("../controllers/subscriptionController");

// =====================================================
// Customer APIs
// =====================================================

// Current Subscription
router.get(
  "/current",
  authMiddleware,
  subscriptionController.getCurrentSubscription
);

// Subscription History
router.get(
  "/history",
  authMiddleware,
  subscriptionController.getSubscriptionHistory
);

// Usage
router.get(
  "/usage",
  authMiddleware,
  subscriptionController.getUsage
);

// Select/change own plan (self-service — always scoped to the caller,
// unlike the admin-only /change-plan below which takes an arbitrary userId)
router.post(
  "/select-plan",
  authMiddleware,
  subscriptionController.selectPlan
);

// Cancel Own Subscription
router.post(
  "/cancel",
  authMiddleware,
  subscriptionController.cancelSubscription
);

// Start Stripe Checkout (new subscription) or update an existing
// Stripe subscription's plan/interval
router.post(
  "/checkout",
  authMiddleware,
  subscriptionController.checkout
);

// Stripe Customer Portal (payment method, invoices, cancellation)
router.post(
  "/portal",
  authMiddleware,
  subscriptionController.portal
);

// Renew Own Subscription
router.post(
  "/renew",
  authMiddleware,
  subscriptionController.renewSubscription
);

// =====================================================
// Admin APIs
// =====================================================

// Upgrade / Downgrade Customer Plan
router.post(
  "/change-plan",
  authMiddleware,
  requireAdmin,
  subscriptionController.changePlan
);

module.exports = router;