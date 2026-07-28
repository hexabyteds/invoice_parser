# Database migrations

Every schema change that needs to reach production goes in this folder as a
new, numbered file. `scripts/migrate.js` (run via `npm run migrate`, and
automatically by `scripts/deploy.sh` on every deploy) applies whichever files
haven't been applied yet, tracked in a `schema_migrations` table. It is safe
to run multiple times and safe to run in production.

## Adding a new migration

1. Make your schema change locally first (e.g. in phpMyAdmin/MySQL Workbench
   against your local dev DB), and confirm the app works with it.
2. Create a new file here named `NNNN_short_description.sql` (or `.js`),
   where `NNNN` is the next number after the highest existing one, e.g.:
   - `0001_add_invoice_tags.sql`
   - `0002_backfill_something.js`
3. Write the change so it is **idempotent-friendly**:
   - Prefer `CREATE TABLE IF NOT EXISTS ...`
   - For `ALTER TABLE ... ADD COLUMN`, either wrap in a `.js` migration that
     checks `information_schema.COLUMNS` first (see example below), or make
     sure you only ever add it once (the migration itself is only ever run
     once and recorded — but writing defensively protects you if you ever
     need to re-run it manually).
4. Commit the migration file together with the code that depends on it.
5. Deploy as usual (`npm run deploy`) — the migration runs automatically on
   the server before the app restarts.
6. After merging, refresh the reference snapshot: `npm run db:snapshot`
   (updates `db/schema.sql` from your local dev DB).

## SQL migration example (`migrations/0001_add_invoice_tags.sql`)

```sql
ALTER TABLE invoices ADD COLUMN tags VARCHAR(255) DEFAULT NULL;
CREATE INDEX idx_invoices_tags ON invoices (tags);
```

## JS migration example (`migrations/0002_backfill_status.js`)

```js
module.exports = {
  async up(db) {
    await db.execute(
      "UPDATE invoices SET status = 'PROCESSED' WHERE status IS NULL"
    );
  },
};
```

## Notes

- Never edit an already-committed/applied migration file — add a new one
  instead. Once a migration has run in production, its contents are
  effectively frozen.
- `db/schema.sql` is a full reference dump for fresh installs / onboarding
  only. It contains `DROP TABLE IF EXISTS` statements and must **never** be
  run against a database that has real data (i.e. never run it against
  production). Production schema changes always go through this folder.
- The one-off `scripts/migrate-admin.js` script predates this framework and
  was already run in production; it's kept for reference but new changes
  should use this folder instead.
