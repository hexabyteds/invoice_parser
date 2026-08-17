const db = require("../config/database");

class InvoiceItemRepository {

    // `connection` defaults to the pool itself (each call implicitly grabs
    // its own connection) — callers that need these statements to share a
    // single connection/transaction (see replaceForInvoice below) pass an
    // explicit PoolConnection instead.
    async create(invoiceId, item, connection = db) {

        const sql = `
            INSERT INTO invoice_items (
                invoice_id,
                description,
                quantity,
                unit_price,
                total_price
            )
            VALUES (?, ?, ?, ?, ?)
        `;

        const values = [
            invoiceId,
            item.description || "",
            item.quantity || 0,
            item.unitPrice || 0,
            item.totalPrice || 0
        ];

        await connection.execute(sql, values);
    }

    async createMany(invoiceId, items = [], connection = db) {

        for (const item of items) {
            await this.create(invoiceId, item, connection);
        }
    }

    async findByInvoice(invoiceId) {

        const sql = `
            SELECT *
            FROM invoice_items
            WHERE invoice_id = ?
            ORDER BY id ASC
        `;

        const [rows] = await db.execute(sql, [invoiceId]);

        return rows;
    }

    // Batch fetch for N invoices in a single query — callers group by
    // invoice_id in memory. See invoiceRepository.mapInvoices.
    async findByInvoiceIds(invoiceIds) {

        if (!invoiceIds.length) {
            return [];
        }

        const sql = `
            SELECT *
            FROM invoice_items
            WHERE invoice_id IN (?)
            ORDER BY invoice_id ASC, id ASC
        `;

        const [rows] = await db.query(sql, [invoiceIds]);

        return rows;
    }

    async delete(invoiceId, connection = db) {

        await connection.execute(
            `DELETE FROM invoice_items WHERE invoice_id = ?`,
            [invoiceId]
        );
    }

    // Atomically replaces every line item for an invoice. Deleting the old
    // rows and inserting the new ones used to be two independent
    // statements — if an insert failed partway (bad data, a dropped
    // connection, ...) the invoice was left with the old rows deleted and
    // only some/none of the new ones written, silently losing line items.
    // Running both inside one transaction means a failure rolls the delete
    // back too, so the invoice never ends up with fewer items than before.
    async replaceForInvoice(invoiceId, items) {

        const connection = await db.getConnection();

        try {

            await connection.beginTransaction();

            await this.delete(invoiceId, connection);
            await this.createMany(invoiceId, items, connection);

            await connection.commit();

        } catch (err) {

            await connection.rollback();
            throw err;

        } finally {

            connection.release();

        }

    }
}

module.exports = new InvoiceItemRepository();