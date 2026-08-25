const db = require("../config/database");
const { formatDate } = require("../utils/dateUtils");

const invoiceItemRepository = require("./invoiceItemRepository");

class InvoiceRepository {

    // Create Invoice
    async create(invoice) {

        const sql = `
            INSERT INTO invoices (
                user_id,
                company_id,
                customer_id,
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
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `;

        const values = [
            invoice.user_id,
            invoice.company_id,
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

    async updateImagePath(id, companyId, imagePath) {
        await db.execute(
            `UPDATE invoices SET image_path = ? WHERE id = ? AND company_id = ?`,
            [imagePath, id, companyId]
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

    // Get invoices belonging to one company — every member with access to
    // that company (owner or authorized freelancer/staff) sees the same
    // set, since the data belongs to the company, not to whoever uploaded
    // it. See middleware/companyContext.js for how companyId is resolved
    // and authorized before reaching here.
    async findByCompany(companyId, { limit = 20, offset = 0, documentType = null, from = null, to = null } = {}) {

        let sql = `SELECT * FROM invoices WHERE company_id = ?`;
        const params = [companyId];

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

    async countByCompany(companyId, { documentType = null, from = null, to = null } = {}) {

        let sql = `SELECT COUNT(*) AS total FROM invoices WHERE company_id = ?`;
        const params = [companyId];

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

    // Get invoice by ID, scoped to the company — an id alone is guessable
    // (auto-increment), so every lookup must also prove company membership
    // via this filter. Never trust an id from the URL on its own.
    //
    // Joins customers to also return the actual selected-customer entity's
    // own name (client_company_name) alongside invoices.client_name (which
    // holds the resolved Party Name — see services/partyNameService.js).
    // The two are conceptually different: client_company_name is "whose
    // books this document belongs to", client_name/Party Name is "the
    // other party on the document". `invoices.*` (not `SELECT *`) avoids
    // an `id`/`created_at`/etc. column collision with the joined table.
    async findById(id, companyId) {

        const sql = `
            SELECT invoices.*, customers.company_name AS client_company_name
            FROM invoices
            LEFT JOIN customers ON customers.id = invoices.customer_id
            WHERE invoices.id = ?
            AND invoices.company_id = ?
            LIMIT 1
        `;

        const [rows] = await db.execute(sql, [
            id,
            companyId
        ]);

        return rows.length ? rows[0] : null;

    }
    // Update invoice
    async update(id, companyId, invoice) {

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
            AND company_id = ?
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
            companyId
        ];

        const [result] = await db.execute(sql, values);

        return result.affectedRows;
    }

    // Delete invoice (scoped to company)
    async deleteById(id, companyId) {

        const [result] = await db.execute(
            `DELETE FROM invoices WHERE id = ? AND company_id = ?`,
            [id, companyId]
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

    // Delete all invoices of one company
    async deleteAll(companyId) {

        await db.execute(
            `DELETE FROM invoices WHERE company_id = ?`,
            [companyId]
        );
    }

    // Source file paths for every one of a company's invoices — read before
    // a bulk delete (deleteAll) so the caller can still clean up the files
    // and reclaim storage afterward, once the rows themselves are gone.
    async findImagePathsByCompany(companyId) {

        const [rows] = await db.execute(
            `SELECT image_path FROM invoices WHERE company_id = ? AND image_path IS NOT NULL`,
            [companyId]
        );

        return rows.map(row => row.image_path);
    }

    // Statistics
    async getStatistics(companyId) {

        const [rows] = await db.execute(`
            SELECT
                COUNT(*) AS totalInvoices,
                COUNT(DISTINCT client_name) AS uniqueClients,
                SUM(total_amount) AS totalAmount,
                SUM(vat_amount) AS totalVAT
            FROM invoices
            WHERE company_id = ?
        `, [companyId]);

        return rows[0];
    }


    async getAnalytics(companyId, clientId = null) {

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
            WHERE company_id = ?
        `;

        const values = [companyId];

        if (clientId) {
            sql += ` AND customer_id = ?`;
            values.push(clientId);
        }

        const [rows] = await db.execute(sql, values);

        return rows[0];
    }
    async findByClient(companyId, clientId, { limit = 20, offset = 0, documentType = null, from = null, to = null } = {}) {

        let sql = `SELECT * FROM invoices WHERE company_id = ? AND customer_id = ?`;
        const params = [companyId, clientId];

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

    async countByClient(companyId, clientId, { documentType = null, from = null, to = null } = {}) {

        let sql = `SELECT COUNT(*) AS total FROM invoices WHERE company_id = ? AND customer_id = ?`;
        const params = [companyId, clientId];

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
    async findForExport(companyId, { clientId = null, from = null, to = null, documentType = null } = {}) {

        let sql = `
            SELECT *
            FROM invoices
            WHERE company_id = ?
        `;

        const values = [companyId];

        if (clientId) {
            sql += ` AND customer_id = ?`;
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


    async getStatisticsByClient(companyId, clientId) {

        const [rows] = await db.execute(`
            SELECT
                COUNT(*) AS totalInvoices,
                SUM(total_amount) AS totalAmount,
                SUM(vat_amount) AS totalVAT,
                COUNT(DISTINCT invoice_no) AS uniqueInvoices
            FROM invoices
            WHERE company_id = ?
            AND customer_id = ?
        `,[companyId, clientId]);

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
                companyId: row.company_id,
                clientId: row.customer_id,

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
