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
    country,
    city,
    trn,
    address,
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

    async countByUser(userId) {

        const [rows] = await db.execute(
            `SELECT COUNT(*) AS total FROM clients WHERE user_id = ?`,
            [userId]
        );

        return Number(rows[0]?.total || 0);
    }

    async findById(id) {
        console.log("id", id);
        const values = [id];
        console.log("values", values);
        const [rows] = await db.execute(
            `SELECT *
             FROM clients
             WHERE id=?`,
            [id]
        );

        return rows[0];
    }

    async update(id, client) {

        await db.execute(`
            UPDATE clients
            SET
                company_name=?,
                contact_person=?,
                email=?,
                phone=?,
                country=?,
                vat_number=?,
                address=?
            WHERE id=?
        `, [
            client.company_name,
            client.contact_person,
            client.email,
            client.phone,
            client.country,
            client.vat_number,
            client.address,
            id
        ]);
    }

    async delete(id) {

        await db.execute(
            `DELETE FROM clients WHERE id=?`,
            [id]
        );

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