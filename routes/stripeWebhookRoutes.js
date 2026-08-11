const express = require("express");

const router = express.Router();

const stripeWebhookController = require("../controllers/stripeWebhookController");

// Raw body is required for Stripe signature verification — this route is
// mounted in app-backend.js BEFORE the global express.json() middleware so
// req.body arrives here as an untouched Buffer.
router.post(
  "/",
  express.raw({ type: "application/json" }),
  (req, res) => stripeWebhookController.handleWebhook(req, res)
);

module.exports = router;
