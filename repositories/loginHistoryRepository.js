const db = require("../config/database");

class LoginHistoryRepository {
  async create({ userId, ipAddress, browser, device }) {
    await db.execute(
      `INSERT INTO login_history (user_id, ip_address, browser, device, login_time)
       VALUES (?, ?, ?, ?, NOW())`,
      [userId, ipAddress ?? null, browser ?? null, device ?? null]
    );
  }

  // db.query (not execute) — mirrors auditLogRepository.findRecentByUser;
  // mysql2's prepared-statement execute() doesn't reliably bind a LIMIT
  // placeholder the same way query() does.
  async findByUserId(userId, limit = 20) {
    const [rows] = await db.query(
      `SELECT id, ip_address, browser, device, login_time, logout_time
       FROM login_history
       WHERE user_id = ?
       ORDER BY login_time DESC, id DESC
       LIMIT ?`,
      [userId, limit]
    );

    return rows;
  }
}

module.exports = new LoginHistoryRepository();
