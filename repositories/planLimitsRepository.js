const db = require("../config/database");

// One row per (plan, account_type) — see migrations/0021. NULL in any
// limit column means Unlimited; never conflated with 0 (which means "not
// allowed").
class PlanLimitsRepository {

  async getForPlanAndAccountType(planId, accountType) {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM plan_limits
      WHERE plan_id = ? AND account_type = ?
      LIMIT 1
      `,
      [planId, accountType]
    );

    return rows[0] || null;
  }

  async getAllForPlan(planId) {
    const [rows] = await db.execute(
      `SELECT * FROM plan_limits WHERE plan_id = ?`,
      [planId]
    );

    return rows;
  }

  // Upserts both account-type rows for a plan in one call — the admin UI
  // always edits Company and Freelancer limits together on the same form
  // (see spec's Plan Configuration UI), so callers always have both.
  async upsertForPlan(planId, { company, freelancer }) {
    await this._upsert(planId, "COMPANY", company);
    await this._upsert(planId, "FREELANCER", freelancer);
  }

  async _upsert(planId, accountType, limits) {
    const existing = await this.getForPlanAndAccountType(planId, accountType);

    const values = [
      limits.companies_limit ?? null,
      limits.customers_limit ?? null,
      limits.suppliers_limit ?? null,
      limits.invoices_limit ?? null,
    ];

    if (existing) {
      await db.execute(
        `
        UPDATE plan_limits
        SET companies_limit = ?, customers_limit = ?, suppliers_limit = ?, invoices_limit = ?, updated_at = NOW()
        WHERE id = ?
        `,
        [...values, existing.id]
      );
      return;
    }

    await db.execute(
      `
      INSERT INTO plan_limits (plan_id, account_type, companies_limit, customers_limit, suppliers_limit, invoices_limit)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [planId, accountType, ...values]
    );
  }

  async deleteForPlan(planId) {
    await db.execute(`DELETE FROM plan_limits WHERE plan_id = ?`, [planId]);
  }
}

module.exports = new PlanLimitsRepository();
