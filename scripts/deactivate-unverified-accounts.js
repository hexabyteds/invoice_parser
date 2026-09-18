/**
 * One-time cleanup: deactivate accounts that never verified their email
 * within 7 days of signing up, catching accounts that already qualify
 * today even if they never attempt to log in again (the ongoing rule in
 * services/authService.js's login() only catches this at the next login
 * attempt — this script backfills everyone already past that point).
 *
 * Mirrors the exact same rule as the login-time check:
 *   - email_verified = 0
 *   - created_at more than 7 days ago
 *   - status currently ACTIVE (not already suspended/deleted)
 *   - no subscription row with status = 'active' (a real paying account
 *     is exempt, same as the login-time check)
 *
 * Defaults to DRY RUN — prints exactly who would be affected and does
 * not write anything. Pass --execute to actually deactivate them.
 *
 * Usage:
 *   node scripts/deactivate-unverified-accounts.js            (dry run)
 *   node scripts/deactivate-unverified-accounts.js --execute  (real run)
 */
require("dotenv").config();

const pool = require("../config/database");

const EXECUTE = process.argv.includes("--execute");

const CANDIDATES_SQL = `
  SELECT u.id, u.email, u.name, u.account_type, u.created_at,
         DATEDIFF(NOW(), u.created_at) AS days_old
  FROM users u
  WHERE u.email_verified = 0
    AND u.status = 'ACTIVE'
    AND u.deleted_at IS NULL
    AND u.created_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)
    AND NOT EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.user_id = u.id AND s.status = 'active'
    )
  ORDER BY u.created_at ASC
`;

async function main() {
  const [candidates] = await pool.execute(CANDIDATES_SQL);

  console.log(`${EXECUTE ? "EXECUTE" : "DRY RUN"} — ${candidates.length} account(s) match: unverified, signed up 7+ days ago, no active paying subscription.\n`);

  for (const row of candidates) {
    console.log(
      `  #${row.id}  ${row.email}  (${row.account_type || "?"})  signed up ${row.days_old} days ago  [${row.created_at.toISOString()}]`
    );
  }

  if (!EXECUTE) {
    console.log("\nDry run only — nothing was changed. Re-run with --execute to actually deactivate these accounts.");
    await pool.end();
    return;
  }

  if (candidates.length === 0) {
    console.log("\nNothing to do.");
    await pool.end();
    return;
  }

  console.log("\nDeactivating...");

  let count = 0;
  for (const row of candidates) {
    await pool.execute(`UPDATE users SET status = 'INACTIVE' WHERE id = ?`, [row.id]);

    await pool.execute(
      `INSERT INTO audit_logs (user_id, action, module, status, description)
       VALUES (?, 'account_deactivated', 'Authentication', 'SUCCESS', ?)`,
      [row.id, "Deactivated by one-time cleanup script: email not verified within 7 days of signup"]
    );

    count += 1;
  }

  console.log(`\nDone — deactivated ${count} account(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
