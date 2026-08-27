const db = require("../config/database");

class AuditLogRepository {

    async create({
        userId,
        companyId = null,
        action,
        module = null,
        status = "SUCCESS",
        description = null,
        customerId = null,
        ipAddress = null,
    }) {

        await db.execute(
            `INSERT INTO audit_logs (user_id, company_id, customer_id, action, module, status, description, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, companyId, customerId, action, module, status, description, ipAddress]
        );
    }

    async findRecentByUser(userId, limit = 15) {

        const [rows] = await db.query(
            `SELECT id, action, description, customer_id, created_at
             FROM audit_logs
             WHERE user_id = ?
             ORDER BY created_at DESC, id DESC
             LIMIT ?`,
            [userId, limit]
        );

        return rows;
    }

    // ---- Super Admin — platform-wide Audit Logs module ----

    _buildFilters({ search, module, action, status, accountType, companyId, userId, dateFrom, dateTo }) {
        const where = [];
        const params = [];

        if (search) {
            const like = `%${search}%`;
            where.push(`
                (u.name LIKE ? OR u.email LIKE ? OR co.name LIKE ? OR CAST(co.id AS CHAR) LIKE ?
                 OR al.action LIKE ? OR al.description LIKE ?)
            `);
            params.push(like, like, like, like, like, like);
        }

        if (module && module !== "all") {
            where.push(`al.module = ?`);
            params.push(module);
        }

        if (action && action !== "all") {
            where.push(`al.action = ?`);
            params.push(action);
        }

        if (status && status !== "all") {
            where.push(`al.status = ?`);
            params.push(status.toUpperCase());
        }

        if (accountType === "ADMIN") {
            where.push(`u.role = 'admin'`);
        } else if (accountType === "COMPANY" || accountType === "FREELANCER") {
            where.push(`u.account_type = ?`);
            params.push(accountType);
        }

        if (companyId) {
            where.push(`al.company_id = ?`);
            params.push(companyId);
        }

        if (userId) {
            where.push(`al.user_id = ?`);
            params.push(userId);
        }

        if (dateFrom) {
            where.push(`al.created_at >= ?`);
            params.push(dateFrom);
        }

        if (dateTo) {
            where.push(`al.created_at <= ?`);
            params.push(dateTo);
        }

        return { where, params };
    }

    async findAll({ limit = 25, offset = 0, ...filters } = {}) {
        const { where, params } = this._buildFilters(filters);
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

        const [rows] = await db.query(
            `
            SELECT
                al.id, al.action, al.module, al.status, al.description, al.ip_address, al.created_at,
                al.company_id, co.name AS company_name,
                al.user_id, u.name AS user_name, u.email AS user_email,
                u.role AS user_role, u.account_type
            FROM audit_logs al
            LEFT JOIN users u ON u.id = al.user_id
            LEFT JOIN companies co ON co.id = al.company_id
            ${whereSql}
            ORDER BY al.created_at DESC, al.id DESC
            LIMIT ? OFFSET ?
            `,
            [...params, limit, offset]
        );

        return rows;
    }

    async countAll(filters = {}) {
        const { where, params } = this._buildFilters(filters);
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

        const [rows] = await db.query(
            `
            SELECT COUNT(*) AS total
            FROM audit_logs al
            LEFT JOIN users u ON u.id = al.user_id
            LEFT JOIN companies co ON co.id = al.company_id
            ${whereSql}
            `,
            params
        );

        return Number(rows[0]?.total || 0);
    }

    async getDistinctActions() {
        const [rows] = await db.query(
            `SELECT DISTINCT action FROM audit_logs WHERE action IS NOT NULL ORDER BY action`
        );
        return rows.map((r) => r.action);
    }
}

module.exports = new AuditLogRepository();
