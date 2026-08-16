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
                document_type,
                invoice_no,
                client_name,
                seller_name,
                buyer_name,
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
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `;

        const values = [
            invoice.user_id,
            invoice.client_id,
            invoice.invoiceType,
            invoice.document_type || invoice.documentType || null,
            invoice.invoiceNo,
            invoice.clientName,
            invoice.sellerName || null,
            invoice.buyerName || null,
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
            invoice.image_path ?? invoice.imagePath ?? null
        ];
    
        const [result] = await db.execute(sql, values);
    
        return result.insertId;
    }

    async updateImagePath(id, userId, imagePath) {
        await db.execute(
            `UPDATE invoices SET image_path = ? WHERE id = ? AND user_id = ?`,
            [imagePath, id, userId]
        );
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
    async findByUser(userId, { limit = 20, offset = 0, documentType = null, from = null, to = null } = {}) {

        let sql = `SELECT * FROM invoices WHERE user_id = ?`;
        const params = [userId];

        if (documentType) {
            sql += ` AND document_type = ?`;
            params.push(documentType);
        }

        if (from) {
            sql += ` AND invoice_date >= ?`;
            params.push(formatDate(from) || from);
        }

        if (to) {
            sql += ` AND invoice_date <= ?`;
            params.push(formatDate(to) || to);
        }

        sql += ` ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const [rows] = await db.query(sql, params);

        return await this.mapInvoices(rows);
    }

    async countByUser(userId, { documentType = null, from = null, to = null } = {}) {

        let sql = `SELECT COUNT(*) AS total FROM invoices WHERE user_id = ?`;
        const params = [userId];

        if (documentType) {
            sql += ` AND document_type = ?`;
            params.push(documentType);
        }

        if (from) {
            sql += ` AND invoice_date >= ?`;
            params.push(formatDate(from) || from);
        }

        if (to) {
            sql += ` AND invoice_date <= ?`;
            params.push(formatDate(to) || to);
        }

        const [rows] = await db.execute(sql, params);

        return Number(rows[0]?.total || 0);
    }

    // Get invoice by ID
    //
    // Joins clients to also return the actual selected-client entity's own
    // name (client_company_name) alongside invoices.client_name (which
    // holds the resolved Party Name — see services/partyNameService.js).
    // The two are conceptually different: client_company_name is "whose
    // books this document belongs to", client_name/Party Name is "the
    // other party on the document". `invoices.*` (not `SELECT *`) avoids
    // an `id`/`created_at`/etc. column collision with the joined table.
    async findById(id, userId) {

        const sql = `
            SELECT invoices.*, clients.company_name AS client_company_name
            FROM invoices
            LEFT JOIN clients ON clients.id = invoices.client_id
            WHERE invoices.id = ?
            AND invoices.user_id = ?
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
                trn = ?,
                document_type = ?
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
            invoice.document_type || null,
            id,
            userId
        ];

        const [result] = await db.execute(sql, values);

        return result.affectedRows;
    }

    // Delete invoice (scoped to user)
    async deleteById(id, userId) {

        const [result] = await db.execute(
            `DELETE FROM invoices WHERE id = ? AND user_id = ?`,
            [id, userId]
        );

        return result.affectedRows;
    }

    // Delete invoice (legacy — prefer deleteById)
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

    // Source file paths for every one of a user's invoices — read before a
    // bulk delete (deleteAll) so the caller can still clean up the files
    // and reclaim storage afterward, once the rows themselves are gone.
    async findImagePathsByUser(userId) {

        const [rows] = await db.execute(
            `SELECT image_path FROM invoices WHERE user_id = ? AND image_path IS NOT NULL`,
            [userId]
        );

        return rows.map(row => row.image_path);
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
    async findByClient(userId, clientId, { limit = 20, offset = 0, documentType = null, from = null, to = null } = {}) {

        let sql = `SELECT * FROM invoices WHERE user_id = ? AND client_id = ?`;
        const params = [userId, clientId];

        if (documentType) {
            sql += ` AND document_type = ?`;
            params.push(documentType);
        }

        if (from) {
            sql += ` AND invoice_date >= ?`;
            params.push(formatDate(from) || from);
        }

        if (to) {
            sql += ` AND invoice_date <= ?`;
            params.push(formatDate(to) || to);
        }

        sql += ` ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const [rows] = await db.query(sql, params);

        return await this.mapInvoices(rows);
    }

    async countByClient(userId, clientId, { documentType = null, from = null, to = null } = {}) {

        let sql = `SELECT COUNT(*) AS total FROM invoices WHERE user_id = ? AND client_id = ?`;
        const params = [userId, clientId];

        if (documentType) {
            sql += ` AND document_type = ?`;
            params.push(documentType);
        }

        if (from) {
            sql += ` AND invoice_date >= ?`;
            params.push(formatDate(from) || from);
        }

        if (to) {
            sql += ` AND invoice_date <= ?`;
            params.push(formatDate(to) || to);
        }

        const [rows] = await db.execute(sql, params);

        return Number(rows[0]?.total || 0);
    }

    // Export filter: optional client + optional document type + optional date range on invoice_date
    async findForExport(userId, { clientId = null, from = null, to = null, documentType = null } = {}) {

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

        if (documentType) {
            sql += ` AND document_type = ?`;
            values.push(documentType);
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

        if (!rows.length) {
            return [];
        }

        const allItems = await invoiceItemRepository.findByInvoiceIds(
            rows.map(row => row.id)
        );

        const itemsByInvoiceId = new Map();

        for (const item of allItems) {
            if (!itemsByInvoiceId.has(item.invoice_id)) {
                itemsByInvoiceId.set(item.invoice_id, []);
            }
            itemsByInvoiceId.get(item.invoice_id).push(item);
        }

        return rows.map(row => {

            const items = itemsByInvoiceId.get(row.id) || [];

            return {

                id: row.id,
                userId: row.user_id,
                clientId: row.client_id,

                invoiceType: row.invoice_type,
                documentType: row.document_type,
                invoiceNo: row.invoice_no,
                clientName: row.client_name,
                sellerName: row.seller_name,
                buyerName: row.buyer_name,

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
            };
        });
    }
}

module.exports = new InvoiceRepository();