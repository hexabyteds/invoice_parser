const db = require("../config/database");
const { formatDate } = require("../utils/dateUtils");

const invoiceItemRepository = require("./invoiceItemRepository");

class InvoiceRepository {

    // Create Invoice
    async create(invoice) {

        const sql = `
            INSERT INTO invoices (
                user_id,
                client_id,
                invoice_type,
                invoice_no,
                client_name,
                invoice_date,
                due_date,
                phone_number,
                location,
                description,
                subtotal,
                vat_rate,
                vat_amount,
                total_amount,
                currency,
                trn,
                image_path
            )
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `;
    
        const values = [
            invoice.user_id,
            invoice.client_id,
            invoice.invoiceType,
            invoice.invoiceNo,
            invoice.clientName,
            formatDate(invoice.invoiceDate) || null,
            formatDate(invoice.dueDate) || null,
            invoice.phoneNumber,
            invoice.location,
            invoice.description,
            invoice.subtotal,
            invoice.vatRate,
            invoice.vatAmount,
            invoice.totalAmount,
            invoice.currency,
            invoice.trn,
            invoice.imagePath || null
        ];
    
        const [result] = await db.execute(sql, values);
    
        return result.insertId;
    }
    // Get all invoices
    async findAll() {

        const [rows] = await db.execute(`
            SELECT *
            FROM invoices
            ORDER BY created_at DESC
        `);

  return await this.mapInvoices(rows);

      
    }

    // Get invoice by ID

    // Get invoices of one user
    async findByUser(userId) {

        const [rows] = await db.execute(
            `SELECT *
             FROM invoices
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [userId]
        );

        return await this.mapInvoices(rows);
    }

    // Get invoice by ID
    async findById(id, userId) {

        const sql = `
            SELECT *
            FROM invoices
            WHERE id = ?
            AND user_id = ?
            LIMIT 1
        `;

        const [rows] = await db.execute(sql, [
            id,
            userId
        ]);

        return rows.length ? rows[0] : null;

    }
    // Update invoice
    async update(id, userId, invoice) {

        const sql = `
            UPDATE invoices SET
                invoice_no = ?,
                client_name = ?,
                invoice_date = ?,
                due_date = ?,
                phone_number = ?,
                location = ?,
                description = ?,
                subtotal = ?,
                vat_rate = ?,
                vat_amount = ?,
                total_amount = ?,
                currency = ?,
                trn = ?
            WHERE id = ?
            AND user_id = ?
        `;

        const values = [
            invoice.invoice_no ?? null,
            invoice.client_name ?? null,
            formatDate(invoice.invoice_date) || null,
            formatDate(invoice.due_date) || null,
            invoice.phone_number ?? null,
            invoice.location ?? null,
            invoice.description ?? null,
            invoice.subtotal ?? 0,
            invoice.vat_rate ?? 0,
            invoice.vat_amount ?? 0,
            invoice.total_amount ?? 0,
            invoice.currency ?? null,
            invoice.trn ?? null,
            id,
            userId
        ];

        const [result] = await db.execute(sql, values);

        return result.affectedRows;
    }

    // Delete invoice
    async delete(id) {

        await db.execute(
            `DELETE FROM invoices WHERE id = ?`,
            [id]
        );
    }

    // Delete all invoices of one user
    async deleteAll(userId) {

        await db.execute(
            `DELETE FROM invoices WHERE user_id = ?`,
            [userId]
        );
    }

    // Statistics
    async getStatistics(userId) {

        const [rows] = await db.execute(`
            SELECT
                COUNT(*) AS totalInvoices,
                COUNT(DISTINCT client_name) AS uniqueClients,
                SUM(total_amount) AS totalAmount,
                SUM(vat_amount) AS totalVAT
            FROM invoices
            WHERE user_id = ?
        `, [userId]);

        return rows[0];
    }


    async getAnalytics(userId, clientId = null) {

        let sql = `
            SELECT
                COUNT(*) AS totalInvoices,
                COALESCE(SUM(total_amount), 0) AS totalRevenue,
                COALESCE(SUM(vat_amount), 0) AS totalVAT,
                COUNT(
                    CASE
                        WHEN MONTH(invoice_date) = MONTH(CURDATE())
                         AND YEAR(invoice_date) = YEAR(CURDATE())
                        THEN 1
                    END
                ) AS monthlyInvoices
            FROM invoices
            WHERE user_id = ?
        `;

        const values = [userId];

        if (clientId) {
            sql += ` AND client_id = ?`;
            values.push(clientId);
        }

        const [rows] = await db.execute(sql, values);

        return rows[0];
    }
    async findByClient(userId, clientId) {

        const [rows] = await db.execute(
            `
            SELECT *
            FROM invoices
            WHERE user_id = ?
            AND client_id = ?
            ORDER BY created_at DESC
            `,
            [userId, clientId]
        );
    
        return await this.mapInvoices(rows);
    }

    // Export filter: optional client + optional date range on invoice_date
    async findForExport(userId, { clientId = null, from = null, to = null } = {}) {

        let sql = `
            SELECT *
            FROM invoices
            WHERE user_id = ?
        `;

        const values = [userId];

        if (clientId) {
            sql += ` AND client_id = ?`;
            values.push(Number(clientId));
        }

        if (from) {
            sql += ` AND invoice_date >= ?`;
            values.push(formatDate(from) || from);
        }

        if (to) {
            sql += ` AND invoice_date <= ?`;
            values.push(formatDate(to) || to);
        }

        sql += ` ORDER BY invoice_date DESC, created_at DESC`;

        const [rows] = await db.execute(sql, values);

        return await this.mapInvoices(rows);
    }


    async getStatisticsByClient(userId, clientId) {

        const [rows] = await db.execute(`
            SELECT
                COUNT(*) AS totalInvoices,
                SUM(total_amount) AS totalAmount,
                SUM(vat_amount) AS totalVAT,
                COUNT(DISTINCT invoice_no) AS uniqueInvoices
            FROM invoices
            WHERE user_id = ?
            AND client_id = ?
        `,[userId, clientId]);
    
        return rows[0];
    }


    async mapInvoices(rows) {

        const invoices = [];
    
        for (const row of rows) {
    
            const items =
                await invoiceItemRepository.findByInvoice(row.id);
    
            invoices.push({
    
                id: row.id,
                userId: row.user_id,
                clientId: row.client_id,
    
                invoiceType: row.invoice_type,
                invoiceNo: row.invoice_no,
                clientName: row.client_name,
    
                invoiceDate: row.invoice_date,
                dueDate: row.due_date,
    
                phoneNumber: row.phone_number,
                location: row.location,
                description: row.description,
    
                subtotal: Number(row.subtotal),
                vatRate: Number(row.vat_rate),
                vatAmount: Number(row.vat_amount),
                totalAmount: Number(row.total_amount),
    
                currency: row.currency,
                trn: row.trn,
                imagePath: row.image_path,
    
                createdAt: row.created_at,
                updatedAt: row.updated_at,
    
                lineItems: items.map(item => ({
                    id: item.id,
                    description: item.description,
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unit_price),
                    totalPrice: Number(item.total_price)
                }))
            });
        }
    
        return invoices;
    }
}

module.exports = new InvoiceRepository();