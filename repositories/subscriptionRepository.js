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

  async getActiveSubscription(userId) {
    const [rows] = await db.execute(
      `
      SELECT
          s.*,
          p.name,
          p.slug,
          p.invoice_limit,
          p.client_limit,
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
      AND s.status = 'active'
      LIMIT 1
      `,
      [userId]
    );

    return rows[0] || null;
  }

  async getSubscriptionHistory(userId) {
    const [rows] = await db.execute(
      `
      SELECT
          s.*,
          p.name,
          p.slug
      FROM subscriptions s
      INNER JOIN plans p
          ON s.plan_id = p.id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
      `,
      [userId]
    );

    return rows;
  }

  // ===========================
  // Create Subscription
  // ===========================

  async createSubscription(data) {
    const [result] = await db.execute(
      `
      INSERT INTO subscriptions
      (
        user_id,
        plan_id,
        status,
        billing_cycle,
        price,
        starts_at,
        expires_at,
        next_billing
      )
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.user_id,
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

  async getInvoiceCount(userId) {
    const [[row]] = await db.execute(
      `
      SELECT COUNT(*) total
      FROM invoices
      WHERE user_id=?
      `,
      [userId]
    );

    return Number(row.total);
  }

  async getClientCount(userId) {
    const [[row]] = await db.execute(
      `
      SELECT COUNT(*) total
      FROM clients
      WHERE user_id=?
      `,
      [userId]
    );

    return Number(row.total);
  }

  async getStorageUsed(userId) {
    const [[row]] = await db.execute(
      `
      SELECT
      COALESCE(SUM(file_size),0) total
      FROM invoices
      WHERE user_id=?
      `,
      [userId]
    );

    return Number(row.total);
  }

  async getOCRUsed(userId) {
    const [[row]] = await db.execute(
      `
      SELECT COUNT(*) total
      FROM invoices
      WHERE user_id=?
      AND ocr_status='completed'
      `,
      [userId]
    );

    return Number(row.total);
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
          s.plan_id,
          s.status,
          s.billing_cycle,
          s.price,
          s.starts_at,
          s.expires_at,
          s.next_billing,
          s.cancelled_at,
          s.created_at,
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
}

module.exports = new SubscriptionRepository();