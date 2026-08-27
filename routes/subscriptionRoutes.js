const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyContext = require("../middleware/companyContext");
const requireAdmin = require("../middleware/requireAdmin");

const subscriptionController = require("../controllers/subscriptionController");

// =====================================================
// Customer APIs
// =====================================================

// Current Subscription
router.get(
  "/current",
  authMiddleware,
  companyContext,
  subscriptionController.getCurrentSubscription
);

// Subscription History
router.get(
  "/history",
  authMiddleware,
  companyContext,
  subscriptionController.getSubscriptionHistory
);

// Usage
router.get(
  "/usage",
  authMiddleware,
  companyContext,
  subscriptionController.getUsage
);

// Select/change own plan (self-service — always scoped to the caller's
// active company, unlike the admin-only /change-plan below which takes an
// arbitrary userId)
router.post(
  "/select-plan",
  authMiddleware,
  companyContext,
  subscriptionController.selectPlan
);

// Cancel Own Subscription
router.post(
  "/cancel",
  authMiddleware,
  companyContext,
  subscriptionController.cancelSubscription
);

// Start Stripe Checkout (new subscription) or update an existing
// Stripe subscription's plan/interval
router.post(
  "/checkout",
  authMiddleware,
  companyContext,
  subscriptionController.checkout
);

// Stripe Customer Portal (payment method, invoices, cancellation) — the
// Stripe identity is the caller's own user/owner, not company-scoped.
router.post(
  "/portal",
  authMiddleware,
  subscriptionController.portal
);

// Renew Own Subscription
router.post(
  "/renew",
  authMiddleware,
  companyContext,
  subscriptionController.renewSubscription
);

// Payment History (Billing & Payments page) — read live from Stripe,
// scoped to the caller's own Stripe customer id only.
router.get(
  "/payments",
  authMiddleware,
  subscriptionController.getPaymentHistory
);

router.get(
  "/payments/:invoiceId",
  authMiddleware,
  subscriptionController.getPaymentDetail
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