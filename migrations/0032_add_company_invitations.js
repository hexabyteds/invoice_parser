/**
 * New table backing the Company -> Freelancer invitation flow (see
 * services/companyService.js). Deliberately separate from
 * `company_memberships` rather than an extension of it: that table's
 * `user_id` is NOT NULL and every other piece of code that reads it
 * (middleware/companyContext.js, middleware/requireCompanyPermission.js,
 * Team & Access, the workspace switcher) assumes every row is a real,
 * already-existing user. An invitation must be able to target an email
 * address with no account yet, so it needs to exist independently of that
 * guarantee. A `company_memberships` row is only ever created at the
 * moment of actual acceptance (companyService._finalizeAcceptance), same
 * as before.
 *
 * No EXPIRED status is stored — expiry is computed at read time
 * (`status = 'PENDING' AND expires_at < NOW()`), so nothing needs a sweep
 * job to keep it accurate. A decline is also stored as REVOKED — the
 * company-facing status list only needs Pending/Accepted/Expired/Revoked,
 * so no separate DECLINED state.
 */

module.exports = {
  async up(db) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS company_invitations (
        id INT NOT NULL AUTO_INCREMENT,
        company_id INT NOT NULL,
        invited_email VARCHAR(255) NOT NULL,
        invited_by INT DEFAULT NULL,
        role ENUM('FREELANCER') NOT NULL DEFAULT 'FREELANCER',
        permissions JSON DEFAULT NULL,
        token_hash VARCHAR(64) NOT NULL,
        status ENUM('PENDING','ACCEPTED','REVOKED') NOT NULL DEFAULT 'PENDING',
        expires_at DATETIME NOT NULL,
        accepted_at DATETIME DEFAULT NULL,
        accepted_by INT DEFAULT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_company_invitations_token_hash (token_hash),
        KEY idx_company_invitations_company_email_status (company_id, invited_email, status),
        KEY fk_company_invitations_invited_by (invited_by),
        KEY fk_company_invitations_accepted_by (accepted_by),
        CONSTRAINT fk_company_invitations_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
        CONSTRAINT fk_company_invitations_invited_by FOREIGN KEY (invited_by) REFERENCES users (id) ON DELETE SET NULL,
        CONSTRAINT fk_company_invitations_accepted_by FOREIGN KEY (accepted_by) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  },
};
