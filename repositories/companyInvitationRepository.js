const db = require("../config/database");

// Selects the same columns everywhere plus a computed `effective_status`
// — PENDING rows whose expires_at has passed display as EXPIRED without
// needing a sweep job to keep a stored status column in sync.
const SELECT_WITH_EFFECTIVE_STATUS = `
  SELECT ci.*,
         CASE
           WHEN ci.status = 'PENDING' AND ci.expires_at < NOW() THEN 'EXPIRED'
           ELSE ci.status
         END AS effective_status
  FROM company_invitations ci
`;

class CompanyInvitationRepository {
    async create({ companyId, invitedEmail, invitedBy, permissions = null, tokenHash, expiresAt }) {
        const [result] = await db.execute(
            `INSERT INTO company_invitations
                (company_id, invited_email, invited_by, role, permissions, token_hash, status, expires_at)
             VALUES (?, ?, ?, 'FREELANCER', ?, ?, 'PENDING', ?)`,
            [
                companyId,
                invitedEmail,
                invitedBy,
                permissions ? JSON.stringify(permissions) : null,
                tokenHash,
                expiresAt,
            ]
        );

        return result.insertId;
    }

    // Only a token that's still actually usable — an expired or
    // already-accepted/revoked invitation must never resolve here, no
    // matter how it's being looked up.
    async findByTokenHash(tokenHash) {
        const [rows] = await db.execute(
            `${SELECT_WITH_EFFECTIVE_STATUS} WHERE ci.token_hash = ? AND ci.status = 'PENDING' AND ci.expires_at > NOW() LIMIT 1`,
            [tokenHash]
        );

        return rows[0] || null;
    }

    // No status/expiry filter — used only to decide *why* a token is
    // invalid (never-existed vs. expired vs. already used) for a clearer
    // "no longer valid" message, never to grant access.
    async findRawByTokenHash(tokenHash) {
        const [rows] = await db.execute(
            `${SELECT_WITH_EFFECTIVE_STATUS} WHERE ci.token_hash = ? LIMIT 1`,
            [tokenHash]
        );

        return rows[0] || null;
    }

    async findById(id) {
        const [rows] = await db.execute(
            `${SELECT_WITH_EFFECTIVE_STATUS} WHERE ci.id = ? LIMIT 1`,
            [id]
        );

        return rows[0] || null;
    }

    async findByCompanyAndId(companyId, id) {
        const [rows] = await db.execute(
            `${SELECT_WITH_EFFECTIVE_STATUS} WHERE ci.id = ? AND ci.company_id = ? LIMIT 1`,
            [id, companyId]
        );

        return rows[0] || null;
    }

    async findByCompany(companyId) {
        const [rows] = await db.execute(
            `${SELECT_WITH_EFFECTIVE_STATUS} WHERE ci.company_id = ? ORDER BY ci.created_at DESC`,
            [companyId]
        );

        return rows;
    }

    // The duplicate-invite guard: an active (still-pending, not-yet-expired)
    // invitation already exists for this company+email — the caller should
    // offer Resend instead of creating a second one.
    async findPendingByCompanyAndEmail(companyId, email) {
        const [rows] = await db.execute(
            `${SELECT_WITH_EFFECTIVE_STATUS} WHERE ci.company_id = ? AND ci.invited_email = ? AND ci.status = 'PENDING' AND ci.expires_at > NOW() LIMIT 1`,
            [companyId, email]
        );

        return rows[0] || null;
    }

    // The invitee's own pending invitations across every company —
    // surfaced in-app (NoCompanyState.jsx) for a logged-in freelancer,
    // same role AuthContext's `invitations` array already plays.
    async findPendingByEmail(email) {
        const [rows] = await db.execute(
            `SELECT ci.id, ci.company_id, ci.role, ci.permissions, ci.invited_email, ci.created_at, ci.expires_at,
                    c.name AS company_name, c.status AS company_status
             FROM company_invitations ci
             JOIN companies c ON c.id = ci.company_id
             WHERE ci.invited_email = ? AND ci.status = 'PENDING' AND ci.expires_at > NOW()
             ORDER BY ci.created_at DESC`,
            [email]
        );

        return rows;
    }

    // Conditional on the current status so two concurrent accept attempts
    // (the emailed token and an in-app accept racing each other, or a
    // double-click) can't both succeed — only the first UPDATE actually
    // matches a row. Callers must check affectedRows === 1.
    async markAccepted(id, acceptedByUserId) {
        const [result] = await db.execute(
            `UPDATE company_invitations
             SET status = 'ACCEPTED', accepted_at = NOW(), accepted_by = ?
             WHERE id = ? AND status = 'PENDING' AND expires_at > NOW()`,
            [acceptedByUserId, id]
        );

        return result.affectedRows === 1;
    }

    async markRevoked(id) {
        const [result] = await db.execute(
            `UPDATE company_invitations SET status = 'REVOKED' WHERE id = ? AND status = 'PENDING'`,
            [id]
        );

        return result.affectedRows === 1;
    }

    // Resend: same invitation row, fresh secret + fresh expiry — the old
    // link stops working the moment this runs, since it only ever
    // resolves by exact token_hash match.
    async regenerateToken(id, tokenHash, expiresAt) {
        const [result] = await db.execute(
            `UPDATE company_invitations SET token_hash = ?, expires_at = ? WHERE id = ? AND status = 'PENDING'`,
            [tokenHash, expiresAt, id]
        );

        return result.affectedRows === 1;
    }
}

module.exports = new CompanyInvitationRepository();
