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
                supplier_id,
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
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `;

        // A Bill's counterparty is a vendor (suppliers table), not a
        // customer — client_id is the generic "selected party" id from the
        // upload form; document_type decides which FK it actually belongs
        // in. Never both, so dashboard/export joins never double-count.
        const documentType = invoice.document_type || invoice.documentType || null;
        const isBill = documentType === "bill";

        const values = [
            invoice.user_id,
            invoice.company_id,
            isBill ? null : invoice.client_id,
            isBill ? invoice.client_id : null,
            invoice.invoiceType,
            documentType,
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
    // Joins customers/suppliers to also return the actual selected-party
    // entity's own name (client_company_name / supplier_company_name)
    // alongside invoices.client_name (which holds the resolved Party Name
    // — see services/partyNameService.js). Only one of customer_id/
    // supplier_id is ever set per row (see create()), so only one of the
    // two joined names comes back non-null. `invoices.*` (not `SELECT *`)
    // avoids an `id`/`created_at`/etc. column collision with the joined
    // tables.
    async findById(id, companyId) {

        const sql = `
            SELECT invoices.*,
                customers.company_name AS client_company_name,
                suppliers.company_name AS supplier_company_name
            FROM invoices
            LEFT JOIN customers ON customers.id = invoices.customer_id
            LEFT JOIN suppliers ON suppliers.id = invoices.supplier_id
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

        // Same isBill branching as create() — client_id is the generic
        // "selected party" id, document_type decides which FK it belongs
        // in. Only touched when the caller explicitly passes client_id
        // (see FreeInvoiceAgent.updateInvoice, which defaults it to the
        // row's existing customer_id/supplier_id otherwise) — a normal
        // field-only edit never unlinks a customer/supplier.
        const documentType = invoice.document_type || null;
        const isBill = documentType === "bill";

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
                document_type = ?,
                customer_id = ?,
                supplier_id = ?
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
            documentType,
            isBill ? null : invoice.client_id ?? null,
            isBill ? invoice.client_id ?? null : null,
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

    // Mirrors findByClient/countByClient above, but for a Bill's
    // counterparty (supplier_id) instead of an Invoice's (customer_id) —
    // powers the Supplier Detail page's Bill History, same as
    // findByClient powers Customer Detail's Invoice History.
    async findBySupplier(companyId, supplierId, { limit = 20, offset = 0, documentType = null, from = null, to = null } = {}) {

        let sql = `SELECT * FROM invoices WHERE company_id = ? AND supplier_id = ?`;
        const params = [companyId, supplierId];

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

    async countBySupplier(companyId, supplierId, { documentType = null, from = null, to = null } = {}) {

        let sql = `SELECT COUNT(*) AS total FROM invoices WHERE company_id = ? AND supplier_id = ?`;
        const params = [companyId, supplierId];

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
    // Joins suppliers so exports (Zoho Bills, QuickBooks) can resolve a
    // Bill's real Vendor Name/payment terms from the linked supplier
    // record instead of only the OCR-extracted Party Name text.
    async findForExport(companyId, { clientId = null, from = null, to = null, documentType = null } = {}) {

        let sql = `
            SELECT invoices.*,
                suppliers.company_name AS supplier_company_name,
                suppliers.payment_terms AS supplier_payment_terms,
                suppliers.trn AS supplier_trn
            FROM invoices
            LEFT JOIN suppliers ON suppliers.id = invoices.supplier_id
            WHERE invoices.company_id = ?
        `;

        const values = [companyId];

        if (clientId) {
            sql += ` AND invoices.customer_id = ?`;
            values.push(Number(clientId));
        }

        if (documentType) {
            sql += ` AND invoices.document_type = ?`;
            values.push(documentType);
        }

        if (from) {
            sql += ` AND invoices.invoice_date >= ?`;
            values.push(formatDate(from) || from);
        }

        if (to) {
            sql += ` AND invoices.invoice_date <= ?`;
            values.push(formatDate(to) || to);
        }

        sql += ` ORDER BY invoices.invoice_date DESC, invoices.created_at DESC`;

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
                supplierId: row.supplier_id,
                supplierCompanyName: row.supplier_company_name ?? null,
                supplierPaymentTerms: row.supplier_payment_terms ?? null,
                supplierTrn: row.supplier_trn ?? null,

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
