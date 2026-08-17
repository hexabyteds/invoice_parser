const db = require("../config/database");

class UsageRepository {

  async create(userId) {

    const [result] = await db.execute(
      `
      INSERT INTO usage_stats
      (
        user_id,
        invoices_used,
        bank_statements_used,
        clients_used,
        ocr_pages_used,
        storage_used,
        api_calls_used,
        team_members_used
      )
      VALUES (?,0,0,0,0,0,0,1)
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
            us.bank_statements_used,
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
// Atomically checks-and-increments in one statement: the WHERE clause is
// evaluated against the row's live value at the moment MySQL applies this
// UPDATE (under the row's write lock), not against a value read earlier by
// the caller — so two concurrent calls for the same user can never both
// succeed past `limit`. Returns whether the increment actually happened.
async incrementInvoicesIfUnderLimit(userId, limit) {

  const [result] = await db.execute(`
      UPDATE usage_stats
      SET invoices_used = invoices_used + 1
      WHERE user_id = ? AND invoices_used < ?
  `,[userId, limit]);

  return result.affectedRows > 0;

}

async decrementInvoices(userId) {

  await db.execute(`
      UPDATE usage_stats
      SET invoices_used = GREATEST(invoices_used-1,0)
      WHERE user_id = ?
  `,[userId]);

}

// Bank statements are tracked separately from invoices_used/invoice_limit
// (see migrations/0007_add_bank_statements_used_to_usage_stats.js) — no
// plan limit gates this yet, so a plain increment/decrement is enough;
// unlike incrementInvoicesIfUnderLimit there's no atomic check-and-cap
// needed here.
async incrementBankStatements(userId) {

  await db.execute(`
      UPDATE usage_stats
      SET bank_statements_used = bank_statements_used + 1
      WHERE user_id = ?
  `,[userId]);

}

async decrementBankStatements(userId) {

  await db.execute(`
      UPDATE usage_stats
      SET bank_statements_used = GREATEST(bank_statements_used-1,0)
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

// Same atomic check-and-increment pattern as incrementInvoicesIfUnderLimit
// — the WHERE clause is evaluated against the row's live value under its
// write lock, so two concurrent client-creation requests for the same
// user can never both succeed past `limit`.
async incrementClientsIfUnderLimit(userId, limit) {

    const [result] = await db.execute(`
        UPDATE usage_stats
        SET clients_used = clients_used + 1
        WHERE user_id = ? AND clients_used < ?
    `,[userId, limit]);

    return result.affectedRows > 0;

}
async decrementClients(userId) {

    await db.execute(`
        UPDATE usage_stats
        SET clients_used = GREATEST(clients_used-1,0)
        WHERE user_id = ?
    `,[userId]);

}
// Same atomic check-and-increment pattern as incrementInvoicesIfUnderLimit,
// sized in pages (a multi-page PDF reserves its whole page count in one
// statement rather than page-by-page).
async incrementOCRIfUnderLimit(userId, pages, limit) {

    const [result] = await db.execute(`
        UPDATE usage_stats
        SET ocr_pages_used = ocr_pages_used + ?
        WHERE user_id = ? AND ocr_pages_used + ? <= ?
    `,[pages, userId, pages, limit]);

    return result.affectedRows > 0;

}

async decrementOCR(userId, pages = 1) {

    await db.execute(`
        UPDATE usage_stats
        SET ocr_pages_used = GREATEST(ocr_pages_used - ?, 0)
        WHERE user_id = ?
    `,[pages, userId]);

}
async addStorage(userId,bytes){

  await db.execute(`
      UPDATE usage_stats
      SET storage_used = storage_used + ?
      WHERE user_id=?
  `,[bytes,userId]);

}

// Same atomic check-and-increment pattern as incrementOCRIfUnderLimit,
// sized in bytes — concurrent uploads for the same user can never push
// storage_used past limitBytes between them.
async addStorageIfUnderLimit(userId, bytes, limitBytes) {

  const [result] = await db.execute(`
      UPDATE usage_stats
      SET storage_used = storage_used + ?
      WHERE user_id = ? AND storage_used + ? <= ?
  `,[bytes, userId, bytes, limitBytes]);

  return result.affectedRows > 0;

}

async removeStorage(userId,bytes){

  await db.execute(`
      UPDATE usage_stats
      SET storage_used = GREATEST(storage_used-?,0)
      WHERE user_id=?
  `,[bytes,userId]);

}
async getDashboardSummary() {

  const [rows] = await db.execute(`
      SELECT

          COUNT(u.id) AS totalCustomers,

          SUM(
              CASE
                  WHEN p.slug = 'free' THEN 1
                  ELSE 0
              END
          ) AS freeUsers,

          SUM(
              CASE
                  WHEN p.slug <> 'free' THEN 1
                  ELSE 0
              END
          ) AS paidUsers,

          COALESCE(SUM(us.invoices_used), 0) AS totalInvoices,

          COALESCE(SUM(us.bank_statements_used), 0) AS totalBankStatements,

          COALESCE(SUM(us.clients_used), 0) AS totalClients,

          COALESCE(SUM(us.ocr_pages_used), 0) AS totalOCR,

          COALESCE(SUM(us.storage_used), 0) AS totalStorage,

          COALESCE(SUM(us.team_members_used), 0) AS totalTeamMembers

      FROM users u

      INNER JOIN subscriptions s
          ON s.user_id = u.id
          AND s.status = 'active'

      INNER JOIN plans p
          ON p.id = s.plan_id

      LEFT JOIN usage_stats us
          ON us.user_id = u.id

      WHERE u.role = 'customer'
  `);

  return rows[0];

}
}

module.exports = new UsageRepository();