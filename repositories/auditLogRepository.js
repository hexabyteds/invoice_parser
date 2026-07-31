const db = require("../config/database");

class AuditLogRepository {

    async create({ userId, action, description = null, clientId = null }) {

        await db.execute(
            `INSERT INTO audit_logs (user_id, client_id, action, description)
             VALUES (?, ?, ?, ?)`,
            [userId, clientId, action, description]
        );
    }

    async findRecentByUser(userId, limit = 15) {

        const [rows] = await db.query(
            `SELECT id, action, description, client_id, created_at
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
