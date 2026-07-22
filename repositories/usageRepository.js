const db = require("../config/database");

class UsageRepository {

  async create(userId) {

    const [result] = await db.execute(
      `
      INSERT INTO usage_stats
      (
        user_id,
        invoices_used,
        clients_used,
        ocr_pages_used,
        storage_used,
        api_calls_used,
        team_members_used
      )
      VALUES (?,0,0,0,0,0,1)
      `,
      [userId]
    );

    return result.insertId;

  }

  async getByUserId(userId) {

    const [rows] = await db.execute(
      `
      SELECT *
      FROM usage_stats
      WHERE user_id = ?
      LIMIT 1
      `,
      [userId]
    );

    return rows[0] || null;

  }

  async updateInvoices(userId, count) {

    await db.execute(
      `
      UPDATE usage_stats
      SET invoices_used = ?
      WHERE user_id = ?
      `,
      [count, userId]
    );

  }

  async updateClients(userId, count) {

    await db.execute(
      `
      UPDATE usage_stats
      SET clients_used = ?
      WHERE user_id = ?
      `,
      [count, userId]
    );

  }

  async updateOCR(userId, count) {

    await db.execute(
      `
      UPDATE usage_stats
      SET ocr_pages_used = ?
      WHERE user_id = ?
      `,
      [count, userId]
    );

  }

  async updateStorage(userId, bytes) {

    await db.execute(
      `
      UPDATE usage_stats
      SET storage_used = ?
      WHERE user_id = ?
      `,
      [bytes, userId]
    );

  }
  async getAllCustomersUsage() {

    const [rows] = await db.execute(`
        SELECT
            u.id,
            u.name,
            u.email,
            u.company_name,

            p.name AS plan_name,
            p.invoice_limit,
            p.client_limit,
            p.ocr_limit,
            p.storage_limit,
            p.user_limit,

            us.invoices_used,
            us.clients_used,
            us.ocr_pages_used,
            us.storage_used,
            us.team_members_used

        FROM users u

        INNER JOIN subscriptions s
            ON s.user_id = u.id
            AND s.status = 'active'

        INNER JOIN plans p
            ON p.id = s.plan_id

        LEFT JOIN usage_stats us
            ON us.user_id = u.id

        WHERE u.role = 'customer'

        ORDER BY u.name
    `);

    return rows;

}
async incrementInvoices(userId) {

  await db.execute(`
      UPDATE usage_stats
      SET invoices_used = invoices_used + 1
      WHERE user_id = ?
  `,[userId]);

}

async decrementInvoices(userId) {

  await db.execute(`
      UPDATE usage_stats
      SET invoices_used = GREATEST(invoices_used-1,0)
      WHERE user_id = ?
  `,[userId]);

}
async incrementClients(userId) {

    await db.execute(`
        UPDATE usage_stats
        SET clients_used = clients_used + 1
        WHERE user_id = ?
    `,[userId]);

}
async decrementClients(userId) {

    await db.execute(`
        UPDATE usage_stats
        SET clients_used = GREATEST(clients_used-1,0)
        WHERE user_id = ?
    `,[userId]);

}
async incrementOCR(userId, pages = 1) {

    await db.execute(`
        UPDATE usage_stats
        SET ocr_pages_used = ocr_pages_used + ?
        WHERE user_id = ?
    `,[pages, userId]);

}
async decrementOCR(userId) {

    await db.execute(`
        UPDATE usage_stats
        SET ocr_pages_used = GREATEST(ocr_pages_used-1,0)
        WHERE user_id = ?
    `,[userId]);

}
async addStorage(userId,bytes){

  await db.execute(`
      UPDATE usage_stats
      SET storage_used = storage_used + ?
      WHERE user_id=?
  `,[bytes,userId]);

}

async removeStorage(userId,bytes){

  await db.execute(`
      UPDATE usage_stats
      SET storage_used = GREATEST(storage_used-?,0)
      WHERE user_id=?
  `,[bytes,userId]);

}
}

module.exports = new UsageRepository();