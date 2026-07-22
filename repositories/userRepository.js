const db = require("../config/database");

function formatUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company_name: row.company_name,
    role: row.role || "customer",
    plan: row.plan || "starter",
    status: row.status || "ACTIVE",
    created_at: row.created_at,
    deleted_at: row.deleted_at || null,
  };
}

class UserRepository {
  async create(user) {
    const sql = `
      INSERT INTO users (
        name,
        email,
        company_name,
        password,
        role,
        plan,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(sql, [
      user.name,
      user.email,
      user.company_name ?? null,
      user.password,
      user.role || "customer",
      user.plan || "FREE",
      user.status || "ACTIVE",
    ]);

    return result.insertId;
  }

  async findById(id) {
    const [rows] = await db.execute(
      `
      SELECT
        id,
        name,
        email,
        company_name,
        role,
        plan,
        status,
        created_at,
        deleted_at
      FROM users
      WHERE id = ?
      `,
      [id]
    );

    return formatUser(rows[0]);
  }

  async findByEmail(email) {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM users
      WHERE email = ?
      LIMIT 1
      `,
      [email]
    );

    return rows[0] || null;
  }

  async update(id, data) {
    const sql = `
      UPDATE users
      SET
        name = ?,
        email = ?
      WHERE id = ?
    `;

    await db.execute(sql, [data.name, data.email, id]);
  }

  async updatePassword(id, password) {
    await db.execute(
      `
      UPDATE users
      SET password = ?
      WHERE id = ?
      `,
      [password, id]
    );
  }

  async delete(id) {
    await db.execute(
      `
      DELETE FROM users
      WHERE id = ?
      `,
      [id]
    );
  }
}

module.exports = new UserRepository();
