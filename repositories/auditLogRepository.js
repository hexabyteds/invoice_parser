const db = require("../config/database");

class AuditLogRepository {

    async create({ userId, companyId = null, action, description = null, customerId = null }) {

        await db.execute(
            `INSERT INTO audit_logs (user_id, company_id, customer_id, action, description)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, companyId, customerId, action, description]
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
}

module.exports = new AuditLogRepository();
