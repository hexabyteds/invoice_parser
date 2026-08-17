const Stripe = require("stripe");
require("dotenv").config();

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn(
    "STRIPE_SECRET_KEY is not set — Stripe billing endpoints will fail until it's configured in .env."
  );
}

// Pin to the API version bundled with the installed SDK so behavior can't
// silently drift if the Stripe account's dashboard-configured default
// version ever changes. Falls back to a placeholder key so the rest of the
// app can still boot when Stripe hasn't been configured yet locally —
// actual Stripe calls will fail loudly instead of crashing app startup.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_unconfigured", {
  apiVersion: Stripe.API_VERSION
});

module.exports = stripe;
