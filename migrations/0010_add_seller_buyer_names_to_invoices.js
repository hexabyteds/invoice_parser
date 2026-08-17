/**
 * Adds two nullable columns to `invoices` that capture BOTH parties printed
 * on the source document, independent of which one is "the client":
 *
 *   seller_name - the seller/issuer/supplier/vendor side
 *   buyer_name  - the buyer/customer/recipient side
 *
 * Why: `client_name` (the existing free-text column driving the "Party
 * Name" shown across the app) used to always be set to whichever single
 * counterparty Gemini extracted ("vendorName"), regardless of whether the
 * document was filed as a Supplier Invoice or a Bill. That's wrong for the
 * Invoice case — when the selected client is the seller, the Party Name
 * the user wants to see is the *buyer*, not the seller. Storing both raw
 * names lets services/partyNameService.js pick the correct side based on
 * document_type, and lets that pick be recalculated later (e.g. if the
 * document type is edited from Invoice to Bill) without re-running OCR.
 *
 * Nullable, no default, and never backfilled — historical rows only ever
 * had one extracted name (already living in client_name) and there's no
 * reliable source to reconstruct the other side from, so they're simply
 * left NULL and the app falls back to the existing client_name value for
 * them (see partyNameService.resolvePartyName's fallback behavior).
 *
 * Written defensively (checks before ALTER), matching earlier migrations
 * in this folder.
 */

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
    if (!(await columnExists(db, "invoices", "seller_name"))) {
      await db.query(
        `ALTER TABLE invoices
         ADD COLUMN seller_name VARCHAR(255) DEFAULT NULL
         AFTER client_name`
      );
    }

    if (!(await columnExists(db, "invoices", "buyer_name"))) {
      await db.query(
        `ALTER TABLE invoices
         ADD COLUMN buyer_name VARCHAR(255) DEFAULT NULL
         AFTER seller_name`
      );
    }
  },
};
