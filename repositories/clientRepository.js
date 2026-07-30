const db = require("../config/database");

class ClientRepository {

    async create(client) {

        console.log("client", client);

        const sql = `
            INSERT INTO clients
(
    user_id,
    company_name,
    contact_person,
    email,
    phone,
    trn,
    address,
    country,
    city,
    notes
)
VALUES (?,?,?,?,?,?,?,?,?,?)
        `;

        const values = [
            client.user_id,
            client.company_name,
            client.contact_person,
            client.email,
            client.phone,
            client.trn,
            client.address,
            client.country,
            client.city,
            client.notes
        ];

        console.log(JSON.stringify(client, null, 2));
        console.log(JSON.stringify(values, null, 2));
        const [result] = await db.execute(sql, values);
        return result.insertId;
    }

    async findByUser(userId) {

        const sql = `
            SELECT *
            FROM clients
            WHERE user_id=?
            ORDER BY company_name
        `;
        const values = [userId];
        const [result] = await db.execute(sql, values);
        return result;
    }

    async findByCompanyName(userId, companyName, excludeId = null) {

        const sql = excludeId
            ? `SELECT id FROM clients WHERE user_id = ? AND LOWER(company_name) = LOWER(?) AND id != ? LIMIT 1`
            : `SELECT id FROM clients WHERE user_id = ? AND LOWER(company_name) = LOWER(?) LIMIT 1`;

        const values = excludeId
            ? [userId, companyName, excludeId]
            : [userId, companyName];

        const [rows] = await db.execute(sql, values);
        return rows[0];
    }

    async countByUser(userId) {

        const [rows] = await db.execute(
            `SELECT COUNT(*) AS total FROM clients WHERE user_id = ?`,
            [userId]
        );

        return Number(rows[0]?.total || 0);
    }

    async update(id, userId, client) {

        const [result] = await db.execute(`
            UPDATE clients
            SET
                company_name=?,
                contact_person=?,
                email=?,
                phone=?,
                trn=?,
                address=?,
                country=?,
                city=?,
                notes=?
            WHERE id=?
            AND user_id=?
        `, [
            client.company_name,
            client.contact_person,
            client.email,
            client.phone,
            client.trn,
            client.address,
            client.country,
            client.city,
            client.notes,
            id,
            userId
        ]);

        return result.affectedRows;
    }

    async delete(id, userId) {

        const [result] = await db.execute(
            `DELETE FROM clients WHERE id=? AND user_id=?`,
            [id, userId]
        );

        return result.affectedRows;

    }

    async findById(id, userId) {

        console.log("id", id);
        console.log("userId", userId);
        const [rows] = await db.execute(
            `
            SELECT *
            FROM clients
            WHERE id = ?
            AND user_id = ?
            LIMIT 1
            `,
            [id, userId]
        );
    
        return rows[0];
    
    }

}

module.exports = new ClientRepository();