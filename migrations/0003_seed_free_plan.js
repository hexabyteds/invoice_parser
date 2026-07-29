/**
 * The `plans` table (created in migration 0001) was never seeded with a
 * default Free plan. Every new registration and every subscription
 * cancellation resolves the Free plan via `slug = 'free'`
 * (subscriptionRepository.getFreePlan), so without this row those flows
 * fail with "Free plan not found." in production.
 *
 * Other plans are managed by admins through the admin portal; Free is the
 * one plan the app depends on existing unconditionally, so it's seeded
 * here instead.
 */

module.exports = {
  async up(db) {
    const [rows] = await db.execute(
      `SELECT id FROM plans WHERE LOWER(slug) = 'free' LIMIT 1`
    );

    if (rows.length > 0) {
      return;
    }

    await db.execute(
      `
      INSERT INTO plans
        (name, slug, monthly_price, yearly_price, invoice_limit, client_limit, user_limit, storage_limit, ocr_limit, api_access, priority_support, active, featured)
      VALUES
        ('Free', 'free', 0, 0, 5, 2, 1, 50, 5, 0, 0, 1, 0)
      `
    );
  },
};
