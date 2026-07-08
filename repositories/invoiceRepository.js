const db = require("../config/database");
const { formatDate } = require("../utils/dateUtils");

const invoiceItemRepository = require("./invoiceItemRepository");

class InvoiceRepository {

    // Create Invoice
    async create(invoice) {

        const sql = `
            INSERT INTO invoices (
                user_id,
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            invoice.user_id,
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
    
        const invoices = [];
    
        for (const row of rows) {
    
            const items = await invoiceItemRepository.findByInvoice(row.id);
    
            invoices.push({
                id: row.id,
                userId: row.user_id,
    
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
    
        const invoices = [];
    
        for (const row of rows) {
    
            const items = await invoiceItemRepository.findByInvoice(row.id);
    
            invoices.push({
                id: row.id,
                userId: row.user_id,
    
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

}

module.exports = new InvoiceRepository();