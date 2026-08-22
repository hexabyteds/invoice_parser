const db = require("../config/database");

class CompanyRepository {

    async create({ name, ownerUserId }) {
        const [result] = await db.execute(
            `INSERT INTO companies (name, owner_user_id, status) VALUES (?, ?, 'ACTIVE')`,
            [name, ownerUserId]
        );

        return result.insertId;
    }

    async createMembership({ companyId, userId, role, status, invitedBy = null, permissions = null }) {
        const [result] = await db.execute(
            `INSERT INTO company_memberships
                (company_id, user_id, role, status, permissions, invited_by, invited_at, accepted_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
            [
                companyId,
                userId,
                role,
                status,
                permissions ? JSON.stringify(permissions) : null,
                invitedBy,
                status === "ACTIVE" ? new Date() : null,
            ]
        );

        return result.insertId;
    }

    // Every membership row for a user, any status — the caller (authService.me)
    // splits this into "active companies" vs "pending invitations".
    async findMembershipsForUser(userId) {
        const [rows] = await db.execute(
            `SELECT m.id, m.company_id, m.role, m.status, m.permissions,
                    m.invited_at, m.accepted_at,
                    c.name AS company_name, c.status AS company_status
             FROM company_memberships m
             JOIN companies c ON c.id = m.company_id
             WHERE m.user_id = ?
             ORDER BY m.invited_at DESC`,
            [userId]
        );

        return rows;
    }

    // Scoped to the calling user — accept/decline must never touch a
    // membership row that isn't actually theirs, regardless of what id
    // they pass.
    async findMembershipForUser(membershipId, userId) {
        const [rows] = await db.execute(
            `SELECT * FROM company_memberships WHERE id = ? AND user_id = ? LIMIT 1`,
            [membershipId, userId]
        );

        return rows[0] || null;
    }

    async updateMembershipStatus(membershipId, status, { acceptedAt = false } = {}) {
        await db.execute(
            acceptedAt
                ? `UPDATE company_memberships SET status = ?, accepted_at = NOW() WHERE id = ?`
                : `UPDATE company_memberships SET status = ? WHERE id = ?`,
            [status, membershipId]
        );
    }

    async deleteMembership(membershipId) {
        await db.execute(`DELETE FROM company_memberships WHERE id = ?`, [membershipId]);
    }

    // ---- Company-scoped (Team & Access) ----

    async findMembersForCompany(companyId) {
        const [rows] = await db.execute(
            `SELECT m.id, m.role, m.status, m.permissions, m.invited_at, m.accepted_at, m.removed_at,
                    u.id AS user_id, u.name, u.email
             FROM company_memberships m
             JOIN users u ON u.id = m.user_id
             WHERE m.company_id = ?
             ORDER BY FIELD(m.role, 'OWNER', 'FREELANCER', 'STAFF'), m.invited_at DESC`,
            [companyId]
        );

        return rows;
    }

    // Never trust a membership id alone — every team-management action must
    // prove the row actually belongs to the caller's current company.
    async findMembershipForCompany(membershipId, companyId) {
        const [rows] = await db.execute(
            `SELECT * FROM company_memberships WHERE id = ? AND company_id = ? LIMIT 1`,
            [membershipId, companyId]
        );

        return rows[0] || null;
    }

    async findMembershipByCompanyAndUser(companyId, userId) {
        const [rows] = await db.execute(
            `SELECT * FROM company_memberships WHERE company_id = ? AND user_id = ? LIMIT 1`,
            [companyId, userId]
        );

        return rows[0] || null;
    }

    async updateMemberStatusForCompany(membershipId, companyId, status) {
        const removedAtClause = status === "REMOVED" ? ", removed_at = NOW()" : "";

        await db.execute(
            `UPDATE company_memberships SET status = ? ${removedAtClause} WHERE id = ? AND company_id = ?`,
            [status, membershipId, companyId]
        );
    }

    async updateMemberPermissionsForCompany(membershipId, companyId, permissions) {
        await db.execute(
            `UPDATE company_memberships SET permissions = ? WHERE id = ? AND company_id = ?`,
            [JSON.stringify(permissions), membershipId, companyId]
        );
    }
}

module.exports = new CompanyRepository();
