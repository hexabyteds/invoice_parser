const db = require("../config/database");

class SubscriptionRepository {
  // ===========================
  // Plans
  // ===========================

  async getFreePlan() {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM plans
      WHERE LOWER(slug) = 'free'
      LIMIT 1
      `
    );

    return rows[0] || null;
  }

  async getPlanById(planId) {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM plans
      WHERE id = ?
      LIMIT 1
      `,
      [planId]
    );

    return rows[0] || null;
  }

  async getPlanBySlug(slug) {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM plans
      WHERE slug = ?
      LIMIT 1
      `,
      [slug]
    );

    return rows[0] || null;
  }

  // ===========================
  // Current Subscription
  // ===========================

  async getActiveSubscription(companyId) {
    const [rows] = await db.execute(
      `
      SELECT
          s.*,
          p.name,
          p.slug,
          p.invoice_limit,
          p.customer_limit,
          p.user_limit,
          p.storage_limit,
          p.ocr_limit,
          p.api_access,
          p.priority_support
      FROM subscriptions s
      INNER JOIN plans p
          ON s.plan_id = p.id
      WHERE
          s.company_id = ?
      AND s.status = 'active'
      LIMIT 1
      `,
      [companyId]
    );

    return rows[0] || null;
  }

  // A Freelancer's own account-level plan — company_id IS NULL identifies
  // it (vs a Company's own per-company row). Same shape as
  // getActiveSubscription so callers can treat both interchangeably.
  async getActiveSubscriptionForUser(userId) {
    const [rows] = await db.execute(
      `
      SELECT
          s.*,
          p.name,
          p.slug,
          p.invoice_limit,
          p.customer_limit,
          p.user_limit,
          p.storage_limit,
          p.ocr_limit,
          p.api_access,
          p.priority_support
      FROM subscriptions s
      INNER JOIN plans p
          ON s.plan_id = p.id
      WHERE
          s.user_id = ?
      AND s.company_id IS NULL
      AND s.status = 'active'
      LIMIT 1
      `,
      [userId]
    );

    return rows[0] || null;
  }

  async getSubscriptionHistory(companyId) {
    const [rows] = await db.execute(
      `
      SELECT
          s.*,
          p.name,
          p.slug
      FROM subscriptions s
      INNER JOIN plans p
          ON s.plan_id = p.id
      WHERE s.company_id = ?
      ORDER BY s.created_at DESC
      `,
      [companyId]
    );

    return rows;
  }

  async getSubscriptionHistoryForUser(userId) {
    const [rows] = await db.execute(
      `
      SELECT
          s.*,
          p.name,
          p.slug
      FROM subscriptions s
      INNER JOIN plans p
          ON s.plan_id = p.id
      WHERE s.user_id = ? AND s.company_id IS NULL
      ORDER BY s.created_at DESC
      `,
      [userId]
    );

    return rows;
  }

  // ===========================
  // Create Subscription
  // ===========================

  // A subscription belongs to EITHER a company (company_id set — a
  // Company account's own plan) OR a Freelancer's account level
  // (company_id NULL, data.user_id required — see migration 0023). For the
  // company case, user_id is resolved from the company's own owner (not
  // from the caller) purely to satisfy the column's NOT NULL-in-spirit
  // attribution; it is never used to look the row back up. For the
  // freelancer case, the caller must pass user_id directly since there's
  // no company row to derive it from.
  async createSubscription(data) {
    let userId = data.user_id || null;

    if (data.company_id) {
      const [[company]] = await db.execute(
        `SELECT owner_user_id FROM companies WHERE id = ? LIMIT 1`,
        [data.company_id]
      );

      if (!company) {
        throw new Error(
          `Cannot create a subscription: company ${data.company_id} not found.`
        );
      }

      userId = company.owner_user_id;
    } else if (!userId) {
      throw new Error(
        "Cannot create a subscription: either company_id or user_id is required."
      );
    }

    const [result] = await db.execute(
      `
      INSERT INTO subscriptions
      (
        user_id,
        company_id,
        plan_id,
        status,
        billing_cycle,
        price,
        starts_at,
        expires_at,
        next_billing
      )
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        data.company_id || null,
        data.plan_id,
        data.status,
        data.billing_cycle,
        data.price,
        data.starts_at,
        data.expires_at,
        data.next_billing,
      ]
    );

    return result.insertId;
  }

  // ===========================
  // Expire Existing Subscription
  // ===========================

  async expireSubscription(subscriptionId) {
    await db.execute(
      `
      UPDATE subscriptions
      SET
          status='expired',
          updated_at=NOW()
      WHERE id=?
      `,
      [subscriptionId]
    );
  }

  // ===========================
  // Cancel Subscription
  // ===========================

  async cancelSubscription(subscriptionId) {
    await db.execute(
      `
      UPDATE subscriptions
      SET
          status='cancelled',
          cancelled_at=NOW(),
          updated_at=NOW()
      WHERE id=?
      `,
      [subscriptionId]
    );
  }

  // ===========================
  // Renew Subscription
  // ===========================

  async renewSubscription(subscriptionId, expiresAt, nextBilling) {
    await db.execute(
      `
      UPDATE subscriptions
      SET
          expires_at=?,
          next_billing=?,
          updated_at=NOW()
      WHERE id=?
      `,
      [
        expiresAt,
        nextBilling,
        subscriptionId
      ]
    );
  }

  // ===========================
  // Update User Plan
  // ===========================

  async updateUserPlan(userId, planSlug) {
    await db.execute(
      `
      UPDATE users
      SET
          plan=?,
          updated_at=NOW()
      WHERE id=?
      `,
      [
        planSlug,
        userId
      ]
    );
  }

  // ===========================
  // Usage Statistics
  // ===========================

  async getInvoiceCount(companyId) {
    const [[row]] = await db.execute(
      `
      SELECT COUNT(*) total
      FROM invoices
      WHERE company_id=?
      `,
      [companyId]
    );

    return Number(row.total);
  }

  async getClientCount(companyId) {
    const [[row]] = await db.execute(
      `
      SELECT COUNT(*) total
      FROM customers
      WHERE company_id=?
      `,
      [companyId]
    );

    return Number(row.total);
  }

  // invoices has no file_size/ocr_status columns — storage and OCR usage
  // are tracked in usage_stats (maintained by usageService on every
  // upload), not derivable per-invoice. Read from there instead.
  async getStorageUsed(companyId) {
    const [[row]] = await db.execute(
      `
      SELECT storage_used total
      FROM usage_stats
      WHERE company_id=?
      `,
      [companyId]
    );

    return Number(row?.total || 0);
  }

  async getOCRUsed(companyId) {
    const [[row]] = await db.execute(
      `
      SELECT ocr_pages_used total
      FROM usage_stats
      WHERE company_id=?
      `,
      [companyId]
    );

    return Number(row?.total || 0);
  }

  // ===========================
  // Admin
  // ===========================

  async getAllSubscriptions() {
    const [rows] = await db.execute(
      `
      SELECT
          s.id,
          s.user_id,
          s.company_id,
          s.plan_id,
          s.status,
          s.billing_cycle,
          s.price,
          s.starts_at,
          s.expires_at,
          s.next_billing,
          s.cancelled_at,
          s.created_at,
          s.cancel_at_period_end,
          s.stripe_status,
          u.name AS customer_name,
          u.email AS customer_email,
          u.company_name,
          p.name AS plan_name,
          p.slug AS plan_slug
      FROM subscriptions s
      INNER JOIN users u
          ON s.user_id = u.id
      INNER JOIN plans p
          ON s.plan_id = p.id
      WHERE u.deleted_at IS NULL
      ORDER BY s.created_at DESC
      `
    );

    return rows;
  }

  async getSubscriptionById(id) {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM subscriptions
      WHERE id=?
      LIMIT 1
      `,
      [id]
    );

    return rows[0] || null;
  }

  // ===========================
  // Stripe
  // ===========================

  async getPlanByStripePriceId(priceId) {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM plans
      WHERE stripe_price_id_monthly = ?
         OR stripe_price_id_yearly = ?
      LIMIT 1
      `,
      [priceId, priceId]
    );

    return rows[0] || null;
  }

  async getUserStripeInfo(userId) {
    const [rows] = await db.execute(
      `
      SELECT id, name, email, stripe_customer_id
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

    return rows[0] || null;
  }

  async setStripeCustomerId(userId, customerId) {
    await db.execute(
      `
      UPDATE users
      SET stripe_customer_id = ?, updated_at = NOW()
      WHERE id = ?
      `,
      [customerId, userId]
    );
  }

  async findUserByStripeCustomerId(customerId) {
    const [rows] = await db.execute(
      `
      SELECT id, name, email, stripe_customer_id
      FROM users
      WHERE stripe_customer_id = ?
      LIMIT 1
      `,
      [customerId]
    );

    return rows[0] || null;
  }

  async findSubscriptionByStripeSubscriptionId(stripeSubscriptionId) {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM subscriptions
      WHERE stripe_subscription_id = ?
      LIMIT 1
      `,
      [stripeSubscriptionId]
    );

    return rows[0] || null;
  }

  // Reconciles a webhook's view of a Stripe subscription onto the local
  // `subscriptions` table. Updates the existing row in place when we've
  // already seen this stripe_subscription_id (renewals, proration updates,
  // status changes on the same subscription) rather than expire+insert —
  // that pattern is reserved for genuinely new subscriptions, so we don't
  // spam a fresh history row on every billing-cycle webhook.
  // data.companyId is required — subscriptions.company_id is NOT NULL, and
  // the INSERT path below used to omit it entirely, so every genuinely new
  // Stripe subscription (as opposed to a renewal/update of one already
  // seen) crashed the webhook. data.userId is kept for the row's own
  // user_id column (attribution — resolved by the caller from the
  // company's owner, same as createSubscription above).
  async upsertStripeSubscription(data) {
    const existing =
      await this.findSubscriptionByStripeSubscriptionId(
        data.stripeSubscriptionId
      );

    if (existing) {
      await db.execute(
        `
        UPDATE subscriptions
        SET
            plan_id = ?,
            status = ?,
            stripe_status = ?,
            billing_cycle = ?,
            price = ?,
            stripe_customer_id = ?,
            stripe_price_id = ?,
            expires_at = ?,
            next_billing = ?,
            cancel_at_period_end = ?,
            updated_at = NOW()
        WHERE id = ?
        `,
        [
          data.planId,
          data.status,
          data.stripeStatus,
          data.billingCycle,
          data.price,
          data.stripeCustomerId,
          data.stripePriceId,
          data.expiresAt,
          data.nextBilling,
          data.cancelAtPeriodEnd ? 1 : 0,
          existing.id
        ]
      );

      return await this.getSubscriptionById(existing.id);
    }

    // New Stripe subscription — expire any other row still marked active
    // before inserting, so the target (a company, or a Freelancer's own
    // account-level row) never has two active rows.
    if (data.companyId) {
      await db.execute(
        `
        UPDATE subscriptions
        SET status = 'expired', updated_at = NOW()
        WHERE company_id = ? AND status = 'active'
        `,
        [data.companyId]
      );
    } else {
      await db.execute(
        `
        UPDATE subscriptions
        SET status = 'expired', updated_at = NOW()
        WHERE user_id = ? AND company_id IS NULL AND status = 'active'
        `,
        [data.userId]
      );
    }

    const [result] = await db.execute(
      `
      INSERT INTO subscriptions
      (
        user_id,
        company_id,
        plan_id,
        status,
        billing_cycle,
        price,
        starts_at,
        expires_at,
        next_billing,
        stripe_subscription_id,
        stripe_customer_id,
        stripe_price_id,
        stripe_status,
        cancel_at_period_end
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.userId,
        data.companyId,
        data.planId,
        data.status,
        data.billingCycle,
        data.price,
        data.startsAt,
        data.expiresAt,
        data.nextBilling,
        data.stripeSubscriptionId,
        data.stripeCustomerId,
        data.stripePriceId,
        data.stripeStatus,
        data.cancelAtPeriodEnd ? 1 : 0
      ]
    );

    return await this.getSubscriptionById(result.insertId);
  }

  // ===========================
  // Stripe Webhook Idempotency
  // ===========================

  async isWebhookEventProcessed(eventId) {
    const [rows] = await db.execute(
      `
      SELECT id
      FROM stripe_webhook_events
      WHERE stripe_event_id = ?
      LIMIT 1
      `,
      [eventId]
    );

    return rows.length > 0;
  }

  // Atomically claims an event via the table's UNIQUE key. Returns true the
  // first time an event id is seen (caller should process it), false on a
  // duplicate delivery (caller should skip processing but still ack 200).
  async markWebhookEventProcessed(eventId, type) {
    try {
      await db.execute(
        `
        INSERT INTO stripe_webhook_events (stripe_event_id, type)
        VALUES (?, ?)
        `,
        [eventId, type]
      );

      return true;
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return false;
      }

      throw err;
    }
  }

  // Compensating rollback: lets a genuinely failed event be retried by
  // Stripe instead of being permanently swallowed by the idempotency claim.
  async unmarkWebhookEventProcessed(eventId) {
    await db.execute(
      `DELETE FROM stripe_webhook_events WHERE stripe_event_id = ?`,
      [eventId]
    );
  }
}

module.exports = new SubscriptionRepository();