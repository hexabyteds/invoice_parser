const db = require("../config/database");

class PlanRepository {

  async getAllPlans() {

    const [rows] = await db.execute(`
      SELECT *
      FROM plans
      ORDER BY monthly_price ASC
    `);

    return rows;

  }
  async getActivePlans() {

    const [rows] = await db.execute(`
        SELECT
            id,
            name,
            slug,
            monthly_price,
            yearly_price,
            invoice_limit,
            client_limit,
            user_limit,
            storage_limit,
            ocr_limit,
            api_access,
            priority_support,
            featured
        FROM plans
        WHERE active = 1
        ORDER BY monthly_price ASC
    `);

    return rows;
}
  async getPlanById(id) {

    const [rows] = await db.execute(
      `
      SELECT *
      FROM plans
      WHERE id = ?
      LIMIT 1
      `,
      [id]
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

  async createPlan(plan) {

    const [result] = await db.execute(
      `
      INSERT INTO plans
      (
        name,
        slug,
        monthly_price,
        yearly_price,
        invoice_limit,
        client_limit,
        user_limit,
        storage_limit,
        ocr_limit,
        api_access,
        priority_support,
        active,
        featured
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `,
      [
        plan.name,
        plan.slug,
        plan.monthly_price,
        plan.yearly_price,
        plan.invoice_limit,
        plan.client_limit,
        plan.user_limit,
        plan.storage_limit,
        plan.ocr_limit,
        plan.api_access,
        plan.priority_support,
        plan.active,
        plan.featured
      ]
    );

    return result.insertId;

  }

  async updatePlan(id, plan) {

    await db.execute(
      `
      UPDATE plans
      SET
        name=?,
        slug=?,
        monthly_price=?,
        yearly_price=?,
        invoice_limit=?,
        client_limit=?,
        user_limit=?,
        storage_limit=?,
        ocr_limit=?,
        api_access=?,
        priority_support=?,
        active=?,
        featured=?
      WHERE id=?
      `,
      [
        plan.name,
        plan.slug,
        plan.monthly_price,
        plan.yearly_price,
        plan.invoice_limit,
        plan.client_limit,
        plan.user_limit,
        plan.storage_limit,
        plan.ocr_limit,
        plan.api_access,
        plan.priority_support,
        plan.active,
        plan.featured,
        id
      ]
    );

  }

  async updateStatus(id, active) {

    await db.execute(
      `
      UPDATE plans
      SET active = ?
      WHERE id = ?
      `,
      [active, id]
    );

  }

  async deletePlan(id) {

    await db.execute(
      `
      DELETE FROM plans
      WHERE id = ?
      `,
      [id]
    );

  }
  async isPlanInUse(id) {

    const [rows] = await db.execute(
      `
      SELECT EXISTS (
        SELECT 1
        FROM subscriptions
        WHERE plan_id = ?
      ) AS in_use
      `,
      [id]
    );
  
    return Boolean(rows[0].in_use);
  
  }

}

module.exports = new PlanRepository();