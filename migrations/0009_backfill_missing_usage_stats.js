/**
 * usageService.ensureUsageRecord() creates a usage_stats row on first use,
 * but any user who was created without ever going through that path (e.g.
 * seeded directly, or from before that self-heal existed) has no row at
 * all — any code path that reads usage_stats directly instead of going
 * through getUsage()/ensureUsageRecord() first would see undefined/null
 * instead of zeros for that user.
 *
 * Backfills a zeroed row for every user currently missing one. Written as
 * a set-based INSERT...SELECT (not per-row) so it stays correct and fast
 * regardless of which/how many users are missing a row in a given
 * environment, rather than hardcoding specific user ids.
 */

module.exports = {
  async up(db) {
    await db.execute(`
      INSERT INTO usage_stats
        (user_id, invoices_used, bank_statements_used, clients_used, ocr_pages_used, storage_used, api_calls_used, team_members_used)
      SELECT
        u.id, 0, 0, 0, 0, 0, 0, 1
      FROM users u
      LEFT JOIN usage_stats us ON us.user_id = u.id
      WHERE us.user_id IS NULL
    `);
  },
};
