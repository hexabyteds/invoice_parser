const db = require("../config/database");

function formatUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company_name: row.company_name,
    country: row.country || null,
    country_code: row.country_code || null,
    mobile_number: row.mobile_number || null,
    role: row.role || "customer",
    plan: row.plan || "starter",
    status: row.status || "ACTIVE",
    account_type: row.account_type || null,
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
        country,
        country_code,
        mobile_number,
        password,
        role,
        plan,
        status,
        account_type
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(sql, [
      user.name,
      user.email,
      user.company_name ?? null,
      user.country ?? null,
      user.country_code ?? null,
      user.mobile_number ?? null,
      user.password,
      user.role || "customer",
      user.plan || "FREE",
      user.status || "ACTIVE",
      user.account_type,
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
        country,
        country_code,
        mobile_number,
        role,
        plan,
        status,
        account_type,
        created_at,
        deleted_at
      FROM users
      WHERE id = ?
      `,
      [id]
    );

    return formatUser(rows[0]);
  }

  // Excludes the caller's own id so a profile-edit save that re-sends the
  // same number it already has doesn't trip its own uniqueness check.
  async findByCountryCodeAndMobile(countryCode, mobileNumber, excludeUserId = null) {
    const [rows] = await db.execute(
      `
      SELECT id
      FROM users
      WHERE country_code = ?
        AND mobile_number = ?
        AND deleted_at IS NULL
        AND (? IS NULL OR id != ?)
      LIMIT 1
      `,
      [countryCode, mobileNumber, excludeUserId, excludeUserId]
    );

    return rows[0] || null;
  }

  async findByEmail(email) {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM users
      WHERE email = ?
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [email]
    );
  
    return rows[0] || null;
  }

  // country / country_code / mobile_number are only included in the SET
  // clause when the caller explicitly passes them (i.e. not undefined) —
  // callers that only touch name/company_name (the pre-existing profile
  // form) leave an existing user's contact info untouched rather than
  // wiping it to NULL.
  async update(id, data) {
    const fields = ["name = ?", "company_name = ?"];
    const params = [data.name, data.company_name ?? null];

    if (data.country !== undefined) {
      fields.push("country = ?");
      params.push(data.country);
    }

    if (data.country_code !== undefined) {
      fields.push("country_code = ?");
      params.push(data.country_code);
    }

    if (data.mobile_number !== undefined) {
      fields.push("mobile_number = ?");
      params.push(data.mobile_number);
    }

    params.push(id);

    await db.execute(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      params
    );
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

  async setResetToken(userId, tokenHash, expiresAt) {
    await db.execute(
      `
      UPDATE users
      SET reset_token_hash = ?, reset_token_expires = ?
      WHERE id = ?
      `,
      [tokenHash, expiresAt, userId]
    );
  }

  async findByResetTokenHash(tokenHash) {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM users
      WHERE reset_token_hash = ?
        AND reset_token_expires > NOW()
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [tokenHash]
    );

    return rows[0] || null;
  }

  async clearResetToken(userId) {
    await db.execute(
      `
      UPDATE users
      SET reset_token_hash = NULL, reset_token_expires = NULL
      WHERE id = ?
      `,
      [userId]
    );
  }
}

module.exports = new UserRepository();
