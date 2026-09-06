/**
 * Fixes a race in Freelancer company-creation limit enforcement (QA audit
 * BUG-01): usage_stats.company_id has a UNIQUE KEY, but MySQL/InnoDB never
 * enforces uniqueness across NULL values, and the Freelancer's
 * account-level usage row (usageRepository.getByUserIdAccountLevel /
 * createAccountLevel) is exactly the `company_id IS NULL` row. Concurrent
 * requests that all see "no account-level row yet" can each insert their
 * own copy — confirmed to produce dozens of duplicate rows under
 * concurrent load, and to let companies_used exceed the plan's limit
 * (usageService.reserveCompanySlot's atomic UPDATE only stays atomic
 * per-row; N duplicate rows means N independent limit windows).
 *
 * Fix: a STORED generated flag column (1 for an account-level row, NULL
 * for every company-scoped row) plus a composite UNIQUE KEY over
 * (user_id, that flag). InnoDB excludes a unique-index row from
 * uniqueness checks whenever any indexed column is NULL, so company-scoped
 * rows (flag = NULL) are untouched by this key — they're already
 * constrained by uq_usage_stats_company_id — while account-level rows
 * (flag = 1) collide on user_id exactly once. This makes "one
 * account-level row per user" DB-enforced instead of app-enforced,
 * closing the TOCTOU window the same way uq_usage_stats_company_id already
 * does for company-scoped rows.
 *
 * The flag is deliberately generated from company_id, not from user_id
 * directly (e.g. `IF(company_id IS NULL, user_id, NULL)` as a first draft
 * of this migration tried) — MySQL refuses a generated column whose
 * expression depends on a column governed by an ON DELETE CASCADE foreign
 * key (usage_stats_ibfk_1, on user_id), failing ALTER TABLE with
 * "Cannot add foreign key constraint" (error 1215). company_id's FK
 * (fk_usage_stats_company) has no CASCADE action, so it's unaffected;
 * user_id only needs to appear in the unique KEY, not inside the
 * generated expression, so the restriction doesn't apply here.
 *
 * Existing duplicate account-level rows (if any exist in this environment
 * already) are collapsed first — kept row's companies_used is recomputed
 * from the user's real company count rather than trusted from any
 * individual duplicate, since the race could have left them out of sync
 * with each other.
 */

async function indexExists(db, table, indexName) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return rows[0].count > 0;
}

async function columnExists(db, table, column) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].count > 0;
}

module.exports = {
  async up(db) {
    // 1. Collapse any existing duplicate account-level rows per user_id
    //    down to one, before the unique key can be added.
    const [dupUsers] = await db.execute(`
      SELECT user_id, COUNT(*) AS cnt
      FROM usage_stats
      WHERE company_id IS NULL
      GROUP BY user_id
      HAVING cnt > 1
    `);

    for (const { user_id: userId } of dupUsers) {
      const [[{ actualCompanies }]] = await db.execute(
        `SELECT COUNT(*) AS actualCompanies FROM companies WHERE owner_user_id = ?`,
        [userId]
      );

      const [rows] = await db.execute(
        `SELECT id FROM usage_stats WHERE user_id = ? AND company_id IS NULL ORDER BY id ASC`,
        [userId]
      );

      const [keep, ...drop] = rows;

      await db.execute(
        `UPDATE usage_stats SET companies_used = ? WHERE id = ?`,
        [actualCompanies, keep.id]
      );

      if (drop.length) {
        await db.query(
          `DELETE FROM usage_stats WHERE id IN (${drop.map(() => "?").join(",")})`,
          drop.map((row) => row.id)
        );
      }

      console.warn(
        `[0029_lock_account_level_usage_stats] Collapsed ${drop.length} duplicate account-level usage row(s) for user_id ${userId}; companies_used reset to actual count (${actualCompanies}).`
      );
    }

    // 2. Add the generated flag column + composite unique key.
    if (!(await columnExists(db, "usage_stats", "account_level_flag"))) {
      await db.query(`
        ALTER TABLE usage_stats
        ADD COLUMN account_level_flag TINYINT
          GENERATED ALWAYS AS (IF(company_id IS NULL, 1, NULL)) STORED
          AFTER company_id
      `);
    }

    if (!(await indexExists(db, "usage_stats", "uq_usage_stats_one_account_row"))) {
      await db.query(`
        ALTER TABLE usage_stats
        ADD UNIQUE KEY uq_usage_stats_one_account_row (user_id, account_level_flag)
      `);
    }
  },
};
