const db = require("../config/database");

// Resolves a Stripe customer id back to the local user + company context
// (needed because Stripe's invoice list has no idea about our Company/
// Freelancer model) — batched in one query per page rather than N+1.
class AdminPaymentRepository {
  async getUsersByStripeCustomerIds(stripeCustomerIds) {
    if (!stripeCustomerIds.length) return [];

    const placeholders = stripeCustomerIds.map(() => "?").join(",");

    const [rows] = await db.query(
      `
      SELECT
        u.id, u.name, u.email, u.account_type, u.stripe_customer_id,
        co.id AS company_id, co.name AS company_name
      FROM users u
      LEFT JOIN companies co ON co.owner_user_id = u.id
      WHERE u.stripe_customer_id IN (${placeholders})
      `,
      stripeCustomerIds
    );

    return rows;
  }

  // Local, Stripe-independent revenue/subscription snapshot — reused
  // as-is from adminRepository's already-accurate MRR calc rather than
  // recomputing it a second way.
  async getSubscriptionCounts() {
    const [[row]] = await db.execute(`
      SELECT
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) AS expired,
        SUM(CASE WHEN status = 'active' AND billing_cycle = 'monthly' THEN 1 ELSE 0 END) AS monthly,
        SUM(CASE WHEN status = 'active' AND billing_cycle = 'yearly' THEN 1 ELSE 0 END) AS yearly
      FROM subscriptions
    `);

    return {
      active: Number(row.active || 0),
      cancelled: Number(row.cancelled || 0),
      expired: Number(row.expired || 0),
      monthly: Number(row.monthly || 0),
      yearly: Number(row.yearly || 0),
    };
  }
}

module.exports = new AdminPaymentRepository();
