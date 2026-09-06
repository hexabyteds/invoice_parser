/**
 * Fixes the concurrent-upload duplicate-party race documented in the QA
 * audit as BUG-03: partyResolutionService.resolveParty() does a SELECT
 * (findMatch) followed by a separate INSERT (customerService.create /
 * supplierService.create) with no locking, and neither `customers` nor
 * `suppliers` had a unique constraint backing the app-level "already
 * exists" checks — so two near-simultaneous uploads referencing the same
 * brand-new vendor/customer could each pass the pre-check and both insert,
 * splitting that party's invoice/payment history across two rows.
 * Confirmed: 10 concurrent resolveParty() calls for one new party produced
 * 2 customer rows for the identical name+TRN.
 *
 * This adds two DB-enforced backstops per table, matching two checks the
 * app already performs (just non-atomically):
 *
 *   - (company_id, trn) — a real TRN match is exact, strong proof of the
 *     same entity (partyResolutionService.findMatch already trusts it
 *     unconditionally). Blank/NULL trn is excluded from the constraint via
 *     a generated column (NULLIF('','') -> NULL, and MySQL/InnoDB never
 *     enforces uniqueness across NULLs) — most customers/suppliers have no
 *     TRN at all, and two different parties both lacking one must not be
 *     forced to collide.
 *   - (company_id, company_name) — customerService.create/supplierService.
 *     create already reject an exact (case-insensitive) duplicate name via
 *     findByCompanyName before insert; this is the same rule, just made
 *     atomic. Relies on the table's own utf8mb4_0900_ai_ci collation for
 *     case-insensitive comparison (matching findByCompanyName's LOWER()
 *     check) — no generated column needed since company_name is NOT NULL.
 *
 * Existing duplicate rows (this race has already been observed to create
 * them) are collapsed first. Both tables are referenced by invoices
 * (ON DELETE CASCADE) and customers is additionally referenced by
 * bank_statements (CASCADE) and audit_logs (SET NULL) — deleting a
 * duplicate without reassigning those references first would silently
 * cascade-delete real invoices/bills/bank statements, so every reference
 * is repointed at the surviving row before the duplicate is removed.
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

// Repoints every FK reference to `drop`'s id over to `keep`'s id, across
// every table that references this party table, then deletes `drop`.
async function mergeDuplicate(db, table, referencingColumns, keepId, dropId) {
  for (const { refTable, refColumn } of referencingColumns) {
    await db.execute(
      `UPDATE ${refTable} SET ${refColumn} = ? WHERE ${refColumn} = ?`,
      [keepId, dropId]
    );
  }
  await db.execute(`DELETE FROM ${table} WHERE id = ?`, [dropId]);
}

async function dedupeByTrn(db, table, referencingColumns) {
  const [dupGroups] = await db.execute(`
    SELECT company_id, trn, COUNT(*) AS cnt
    FROM ${table}
    WHERE trn IS NOT NULL AND trn != ''
    GROUP BY company_id, trn
    HAVING cnt > 1
  `);

  for (const { company_id: companyId, trn } of dupGroups) {
    const [rows] = await db.execute(
      `SELECT id FROM ${table} WHERE company_id = ? AND trn = ? ORDER BY id ASC`,
      [companyId, trn]
    );
    const [keep, ...drop] = rows;

    for (const row of drop) {
      await mergeDuplicate(db, table, referencingColumns, keep.id, row.id);
    }

    console.warn(
      `[0030_dedupe_and_lock_party_identity] ${table}: collapsed ${drop.length} duplicate row(s) sharing TRN "${trn}" in company ${companyId} into id ${keep.id}.`
    );
  }
}

async function dedupeByName(db, table, referencingColumns) {
  const [dupGroups] = await db.execute(`
    SELECT company_id, LOWER(TRIM(company_name)) AS norm_name, COUNT(*) AS cnt
    FROM ${table}
    GROUP BY company_id, norm_name
    HAVING cnt > 1
  `);

  for (const { company_id: companyId, norm_name: normName } of dupGroups) {
    const [rows] = await db.execute(
      `SELECT id FROM ${table} WHERE company_id = ? AND LOWER(TRIM(company_name)) = ? ORDER BY id ASC`,
      [companyId, normName]
    );
    const [keep, ...drop] = rows;

    for (const row of drop) {
      await mergeDuplicate(db, table, referencingColumns, keep.id, row.id);
    }

    console.warn(
      `[0030_dedupe_and_lock_party_identity] ${table}: collapsed ${drop.length} duplicate row(s) sharing name "${normName}" in company ${companyId} into id ${keep.id}.`
    );
  }
}

async function lockIdentity(db, table) {
  if (!(await columnExists(db, table, "trn_dedup_key"))) {
    await db.query(`
      ALTER TABLE ${table}
      ADD COLUMN trn_dedup_key VARCHAR(100)
        GENERATED ALWAYS AS (NULLIF(trn, '')) STORED
        AFTER trn
    `);
  }

  const trnIndex = `uq_${table}_company_trn`;
  if (!(await indexExists(db, table, trnIndex))) {
    await db.query(`
      ALTER TABLE ${table}
      ADD UNIQUE KEY ${trnIndex} (company_id, trn_dedup_key)
    `);
  }

  const nameIndex = `uq_${table}_company_name`;
  if (!(await indexExists(db, table, nameIndex))) {
    await db.query(`
      ALTER TABLE ${table}
      ADD UNIQUE KEY ${nameIndex} (company_id, company_name)
    `);
  }
}

module.exports = {
  async up(db) {
    const customerRefs = [
      { refTable: "invoices", refColumn: "customer_id" },
      { refTable: "bank_statements", refColumn: "customer_id" },
      { refTable: "audit_logs", refColumn: "customer_id" },
    ];
    const supplierRefs = [
      { refTable: "invoices", refColumn: "supplier_id" },
    ];

    await dedupeByTrn(db, "customers", customerRefs);
    await dedupeByName(db, "customers", customerRefs);
    await lockIdentity(db, "customers");

    await dedupeByTrn(db, "suppliers", supplierRefs);
    await dedupeByName(db, "suppliers", supplierRefs);
    await lockIdentity(db, "suppliers");
  },
};
