const db = require("../config/database");

class ClientRepository {

    // Every read/write here is scoped by company_id — a client (customer/
    // supplier contact) belongs to the company, not to whoever created it,
    // same rule as invoices and bank statements. user_id is still recorded
    // on the row (create) for attribution only.

    async create(client) {

        const sql = `
            INSERT INTO clients
(
    user_id,
    company_id,
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
VALUES (?,?,?,?,?,?,?,?,?,?,?)
        `;

        const values = [
            client.user_id,
            client.company_id,
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

        const [result] = await db.execute(sql, values);
        return result.insertId;
    }

    async findByCompany(companyId) {

        const sql = `
            SELECT *
            FROM clients
            WHERE company_id=?
            ORDER BY company_name
        `;
        const values = [companyId];
        const [result] = await db.execute(sql, values);
        return result;
    }

    async findByCompanyName(companyId, companyName, excludeId = null) {

        const sql = excludeId
            ? `SELECT id FROM clients WHERE company_id = ? AND LOWER(company_name) = LOWER(?) AND id != ? LIMIT 1`
            : `SELECT id FROM clients WHERE company_id = ? AND LOWER(company_name) = LOWER(?) LIMIT 1`;

        const values = excludeId
            ? [companyId, companyName, excludeId]
            : [companyId, companyName];

        const [rows] = await db.execute(sql, values);
        return rows[0];
    }

    async countByCompany(companyId) {

        const [rows] = await db.execute(
            `SELECT COUNT(*) AS total FROM clients WHERE company_id = ?`,
            [companyId]
        );

        return Number(rows[0]?.total || 0);
    }

    async update(id, companyId, client) {

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
            AND company_id=?
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
            companyId
        ]);

        return result.affectedRows;
    }

    async updateStatus(id, companyId, status) {

        const [result] = await db.execute(
            `UPDATE clients SET status=? WHERE id=? AND company_id=?`,
            [status, id, companyId]
        );

        return result.affectedRows;
    }

    async delete(id, companyId) {

        const [result] = await db.execute(
            `DELETE FROM clients WHERE id=? AND company_id=?`,
            [id, companyId]
        );

        return result.affectedRows;

    }

    async findById(id, companyId) {

        const [rows] = await db.execute(
            `
            SELECT *
            FROM clients
            WHERE id = ?
            AND company_id = ?
            LIMIT 1
            `,
            [id, companyId]
        );

        return rows[0];

    }

}

module.exports = new ClientRepository();
