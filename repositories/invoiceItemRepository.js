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

        const [rows] = await db.execute(
            `SELECT * FROM invoice_items WHERE invoice_id = ?`,
            [invoiceId]
        );

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