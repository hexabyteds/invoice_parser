const db = require("../config/database");

class UsageRepository {

  // Usage/quota belongs to the company, not to whoever happens to be
  // acting (an owner today, a freelancer tomorrow) — every method below is
  // keyed by company_id. user_id is still populated (as the company's
  // owner) purely for the column's NOT NULL/FK constraint and for
  // attribution; it is never used to look the row up.
  async create(companyId) {

    const [[company]] = await db.execute(
      `SELECT owner_user_id FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );

    if (!company) {
      throw new Error(`Cannot create a usage record: company ${companyId} not found.`);
    }

    const [result] = await db.execute(
      `
      INSERT INTO usage_stats
      (
        user_id,
        company_id,
        invoices_used,
        bank_statements_used,
        customers_used,
        ocr_pages_used,
        storage_used,
        api_calls_used,
        team_members_used
      )
      VALUES (?,?,0,0,0,0,0,0,1)
      `,
      [company.owner_user_id, companyId]
    );

    return result.insertId;

  }

  async getByCompanyId(companyId) {

    const [rows] = await db.execute(
      `
      SELECT *
      FROM usage_stats
      WHERE company_id = ?
      LIMIT 1
      `,
      [companyId]
    );

    return rows[0] || null;

  }

  async updateInvoices(companyId, count) {

    await db.execute(
      `
      UPDATE usage_stats
      SET invoices_used = ?
      WHERE company_id = ?
      `,
      [count, companyId]
    );

  }

  async updateCustomers(companyId, count) {

    await db.execute(
      `
      UPDATE usage_stats
      SET customers_used = ?
      WHERE company_id = ?
      `,
      [count, companyId]
    );

  }

  async updateOCR(companyId, count) {

    await db.execute(
      `
      UPDATE usage_stats
      SET ocr_pages_used = ?
      WHERE company_id = ?
      `,
      [count, companyId]
    );

  }

  async updateStorage(companyId, bytes) {

    await db.execute(
      `
      UPDATE usage_stats
      SET storage_used = ?
      WHERE company_id = ?
      `,
      [bytes, companyId]
    );

  }

  // Admin-only aggregate views — deliberately left keyed by user_id (the
  // owning company's owner). Every subscriptions/usage_stats row still
  // carries a populated, valid user_id (the company's owner) alongside its
  // company_id, so this remains correct as a one-row-per-company summary;
  // it just isn't a per-company view by name yet. Revisit if/when a company
  // can have an owner other than the account that created it.
  async getAllCustomersUsage() {

    const [rows] = await db.execute(`
        SELECT
            u.id,
            u.name,
            u.email,
            u.company_name,

            p.name AS plan_name,
            p.invoice_limit,
            p.customer_limit,
            p.ocr_limit,
            p.storage_limit,
            p.user_limit,

            us.invoices_used,
            us.bank_statements_used,
            us.customers_used,
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
// the caller — so two concurrent calls for the same company can never both
// succeed past `limit`. Returns whether the increment actually happened.
// `limit === null` means Unlimited (see plan_limits) — `x < NULL` is
// always unknown/false in SQL, so that case increments unconditionally
// instead of going through the capped WHERE clause.
async incrementInvoicesIfUnderLimit(companyId, limit) {

  const [result] = limit === null
    ? await db.execute(`
        UPDATE usage_stats
        SET invoices_used = invoices_used + 1
        WHERE company_id = ?
    `,[companyId])
    : await db.execute(`
        UPDATE usage_stats
        SET invoices_used = invoices_used + 1
        WHERE company_id = ? AND invoices_used < ?
    `,[companyId, limit]);

  return result.affectedRows > 0;

}

async decrementInvoices(companyId) {

  await db.execute(`
      UPDATE usage_stats
      SET invoices_used = GREATEST(invoices_used-1,0)
      WHERE company_id = ?
  `,[companyId]);

}

// Bank statements are tracked separately from invoices_used/invoice_limit
// (see migrations/0007_add_bank_statements_used_to_usage_stats.js) — no
// plan limit gates this yet, so a plain increment/decrement is enough;
// unlike incrementInvoicesIfUnderLimit there's no atomic check-and-cap
// needed here.
async incrementBankStatements(companyId) {

  await db.execute(`
      UPDATE usage_stats
      SET bank_statements_used = bank_statements_used + 1
      WHERE company_id = ?
  `,[companyId]);

}

async decrementBankStatements(companyId) {

  await db.execute(`
      UPDATE usage_stats
      SET bank_statements_used = GREATEST(bank_statements_used-1,0)
      WHERE company_id = ?
  `,[companyId]);

}
async incrementCustomers(companyId) {

    await db.execute(`
        UPDATE usage_stats
        SET customers_used = customers_used + 1
        WHERE company_id = ?
    `,[companyId]);

}

// Same atomic check-and-increment pattern as incrementInvoicesIfUnderLimit
// — the WHERE clause is evaluated against the row's live value under its
// write lock, so two concurrent client-creation requests for the same
// company can never both succeed past `limit`.
async incrementCustomersIfUnderLimit(companyId, limit) {

    const [result] = limit === null
        ? await db.execute(`
            UPDATE usage_stats
            SET customers_used = customers_used + 1
            WHERE company_id = ?
        `,[companyId])
        : await db.execute(`
            UPDATE usage_stats
            SET customers_used = customers_used + 1
            WHERE company_id = ? AND customers_used < ?
        `,[companyId, limit]);

    return result.affectedRows > 0;

}
async decrementCustomers(companyId) {

    await db.execute(`
        UPDATE usage_stats
        SET customers_used = GREATEST(customers_used-1,0)
        WHERE company_id = ?
    `,[companyId]);

}

// Same atomic check-and-increment pattern as incrementCustomersIfUnderLimit.
// `limit === null` means Unlimited (see plan_limits) — increments
// unconditionally rather than applying a numeric cap.
async incrementSuppliersIfUnderLimit(companyId, limit) {

    const [result] = limit === null
        ? await db.execute(`
            UPDATE usage_stats
            SET suppliers_used = suppliers_used + 1
            WHERE company_id = ?
        `,[companyId])
        : await db.execute(`
            UPDATE usage_stats
            SET suppliers_used = suppliers_used + 1
            WHERE company_id = ? AND suppliers_used < ?
        `,[companyId, limit]);

    return result.affectedRows > 0;

}

async decrementSuppliers(companyId) {

    await db.execute(`
        UPDATE usage_stats
        SET suppliers_used = GREATEST(suppliers_used-1,0)
        WHERE company_id = ?
    `,[companyId]);

}

async updateSuppliers(companyId, count) {

    await db.execute(`
        UPDATE usage_stats
        SET suppliers_used = ?
        WHERE company_id = ?
    `,[count, companyId]);

}

// Freelancer account-level counter (company_id IS NULL — see migration
// 0023/0025) — how many companies this Freelancer currently owns. Same
// atomic check-and-increment pattern, keyed by user_id instead of
// company_id since there's no company yet at the moment this is called
// (this IS the check that gates creating one).
async incrementCompaniesIfUnderLimit(userId, limit) {

    const [result] = limit === null
        ? await db.execute(`
            UPDATE usage_stats
            SET companies_used = companies_used + 1
            WHERE user_id = ? AND company_id IS NULL
        `,[userId])
        : await db.execute(`
            UPDATE usage_stats
            SET companies_used = companies_used + 1
            WHERE user_id = ? AND company_id IS NULL AND companies_used < ?
        `,[userId, limit]);

    return result.affectedRows > 0;

}

async decrementCompanies(userId) {

    await db.execute(`
        UPDATE usage_stats
        SET companies_used = GREATEST(companies_used-1,0)
        WHERE user_id = ? AND company_id IS NULL
    `,[userId]);

}

async getByUserIdAccountLevel(userId) {

    const [rows] = await db.execute(`
        SELECT *
        FROM usage_stats
        WHERE user_id = ? AND company_id IS NULL
        LIMIT 1
    `,[userId]);

    return rows[0] || null;

}

async createAccountLevel(userId) {

    const [result] = await db.execute(`
        INSERT INTO usage_stats
        (user_id, company_id, invoices_used, bank_statements_used, customers_used,
         suppliers_used, companies_used, ocr_pages_used, storage_used, api_calls_used, team_members_used)
        VALUES (?, NULL, 0, 0, 0, 0, 0, 0, 0, 0, 1)
    `,[userId]);

    return result.insertId;

}
// Same atomic check-and-increment pattern as incrementInvoicesIfUnderLimit,
// sized in pages (a multi-page PDF reserves its whole page count in one
// statement rather than page-by-page).
async incrementOCRIfUnderLimit(companyId, pages, limit) {

    const [result] = await db.execute(`
        UPDATE usage_stats
        SET ocr_pages_used = ocr_pages_used + ?
        WHERE company_id = ? AND ocr_pages_used + ? <= ?
    `,[pages, companyId, pages, limit]);

    return result.affectedRows > 0;

}

async decrementOCR(companyId, pages = 1) {

    await db.execute(`
        UPDATE usage_stats
        SET ocr_pages_used = GREATEST(ocr_pages_used - ?, 0)
        WHERE company_id = ?
    `,[pages, companyId]);

}
async addStorage(companyId,bytes){

  await db.execute(`
      UPDATE usage_stats
      SET storage_used = storage_used + ?
      WHERE company_id=?
  `,[bytes,companyId]);

}

// Same atomic check-and-increment pattern as incrementOCRIfUnderLimit,
// sized in bytes — concurrent uploads for the same company can never push
// storage_used past limitBytes between them.
async addStorageIfUnderLimit(companyId, bytes, limitBytes) {

  const [result] = await db.execute(`
      UPDATE usage_stats
      SET storage_used = storage_used + ?
      WHERE company_id = ? AND storage_used + ? <= ?
  `,[bytes, companyId, bytes, limitBytes]);

  return result.affectedRows > 0;

}

async removeStorage(companyId,bytes){

  await db.execute(`
      UPDATE usage_stats
      SET storage_used = GREATEST(storage_used-?,0)
      WHERE company_id=?
  `,[bytes,companyId]);

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

          COALESCE(SUM(us.customers_used), 0) AS totalClients,

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
