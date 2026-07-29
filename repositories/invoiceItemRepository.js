const db = require("../config/database");

class InvoiceItemRepository {

    async create(invoiceId, item) {

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

        await db.execute(sql, values);
    }

    async createMany(invoiceId, items = []) {

        for (const item of items) {
            await this.create(invoiceId, item);
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

    async delete(invoiceId) {

        await db.execute(
            `DELETE FROM invoice_items WHERE invoice_id = ?`,
            [invoiceId]
        );
    }
}

module.exports = new InvoiceItemRepository();