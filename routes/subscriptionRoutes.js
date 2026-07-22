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

// Cancel Own Subscription
router.post(
  "/cancel",
  authMiddleware,
  subscriptionController.cancelSubscription
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