/**
 * Companies were only ever created with a bare `name` (registration and
 * the Freelancer self-service create-company flow both only asked for
 * that). Adds the basic business details a real company record needs:
 * address, phone, email, and TRN (VAT registration number, matching the
 * naming already used on customers/suppliers).
 */

async function columnExists(db, table, column) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].count > 0;
}

const NEW_COLUMNS = [
  ["address", "TEXT"],
  ["phone", "VARCHAR(30) DEFAULT NULL"],
  ["email", "VARCHAR(255) DEFAULT NULL"],
  ["trn", "VARCHAR(100) DEFAULT NULL"],
];

module.exports = {
  async up(db) {
    for (const [col, def] of NEW_COLUMNS) {
      if (!(await columnExists(db, "companies", col))) {
        await db.query(`ALTER TABLE companies ADD COLUMN \`${col}\` ${def}`);
      }
    }
  },
};
