// Every existing Freelancer already has 0+ companies, each with its OWN
// subscription row from before this feature (one-subscription-per-company
// was the only model that existed). Freelancer limit-checking now reads a
// single account-level subscription/usage_stats row instead (company_id IS
// NULL) — this backfill creates that row for each existing Freelancer
// without touching or deleting any of their companies' original per-company
// subscription rows (kept as historical data, simply no longer read for
// limit purposes for Freelancer-owned companies going forward).
//
// Plan choice: the highest-priced ACTIVE plan among the Freelancer's
// owned companies' subscriptions, defaulting to Free if none — never
// silently downgrades an existing paying Freelancer. A Freelancer with two
// different paid plans across companies is logged for manual admin review
// rather than guessed at further.
//
// companies_used is set to the Freelancer's actual current company count,
// even if that already exceeds the Free plan's cap of 2 — existing
// companies are never deleted or hidden; the Freelancer simply can't
// create additional ones until they upgrade (matches the "don't break
// existing users" requirement).
module.exports = {
  async up(db) {
    const [freelancers] = await db.execute(
      `SELECT id FROM users WHERE account_type = 'FREELANCER'`
    );

    if (!freelancers.length) return;

    const [[freePlan]] = await db.execute(
      `SELECT id FROM plans WHERE slug = 'free' LIMIT 1`
    );

    const ambiguous = [];

    for (const freelancer of freelancers) {
      const userId = freelancer.id;

      const [[existingSub]] = await db.execute(
        `SELECT id FROM subscriptions WHERE user_id = ? AND company_id IS NULL LIMIT 1`,
        [userId]
      );

      const [companies] = await db.execute(
        `SELECT id FROM companies WHERE owner_user_id = ?`,
        [userId]
      );
      const companiesUsed = companies.length;

      if (!existingSub) {
        const [ownedPlans] = await db.execute(
          `
          SELECT DISTINCT p.id, p.name, p.monthly_price
          FROM subscriptions s
          INNER JOIN companies c ON c.id = s.company_id
          INNER JOIN plans p ON p.id = s.plan_id
          WHERE c.owner_user_id = ? AND s.status = 'active'
          ORDER BY p.monthly_price DESC
          `,
          [userId]
        );

        const chosenPlanId = ownedPlans[0]?.id || freePlan?.id;

        if (ownedPlans.length > 1) {
          const distinctPrices = new Set(ownedPlans.map((p) => p.monthly_price));
          if (distinctPrices.size > 1) {
            ambiguous.push(userId);
          }
        }

        if (chosenPlanId) {
          await db.execute(
            `
            INSERT INTO subscriptions
              (user_id, company_id, plan_id, status, billing_cycle, price, starts_at)
            VALUES (?, NULL, ?, 'active', 'monthly', 0, NOW())
            `,
            [userId, chosenPlanId]
          );
        }
      }

      const [[existingUsage]] = await db.execute(
        `SELECT id FROM usage_stats WHERE user_id = ? AND company_id IS NULL LIMIT 1`,
        [userId]
      );

      if (!existingUsage) {
        await db.execute(
          `
          INSERT INTO usage_stats
            (user_id, company_id, invoices_used, bank_statements_used, customers_used,
             suppliers_used, companies_used, ocr_pages_used, storage_used, api_calls_used, team_members_used)
          VALUES (?, NULL, 0, 0, 0, 0, ?, 0, 0, 0, 1)
          `,
          [userId, companiesUsed]
        );
      } else {
        await db.execute(
          `UPDATE usage_stats SET companies_used = ? WHERE id = ?`,
          [companiesUsed, existingUsage.id]
        );
      }
    }

    if (ambiguous.length) {
      console.warn(
        `[0025_backfill_freelancer_account_level_plan] Freelancer(s) with multiple differently-priced active company plans — defaulted to the highest, review manually in Super Admin: user_id ${ambiguous.join(", ")}`
      );
    }
  },
};
