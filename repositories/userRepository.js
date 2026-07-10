const db = require("../config/database");

class UserRepository {

    // Create new user
    async create(user) {

        const sql = `
            INSERT INTO users (
                name,
                email,
                company_name,
                password
            )
            VALUES (?, ?, ?, ?)
        `;

        const [result] = await db.execute(sql, [
            user.name,
            user.email,
            user.company,
            user.password,
    
        ]);

        return result.insertId;
    }

    // Find by ID
    async findById(id) {

        const [rows] = await db.execute(
            `
            SELECT
                id,
                name,
                email,
                created_at
            FROM users
            WHERE id = ?
            `,
            [id]
        );

        return rows[0] || null;
    }

    // Find by Email
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

    // Update User
    async update(id, data) {

        const sql = `
            UPDATE users
            SET
                name = ?,
                email = ?
            WHERE id = ?
        `;

        await db.execute(sql, [
            data.name,
            data.email,
            id
        ]);
    }

    // Update Password
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

    // Delete User
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