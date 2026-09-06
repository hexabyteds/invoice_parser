const db = require("../config/database");
const validationService = require("../services/validationService");

// Fields validationService.validate() looks at, mapped from DB snake_case
// to the camelCase shape it expects — kept in sync with invoiceRepository's
// column list so confidence scoring here matches the invoice detail page.
function toValidationShape(row) {
    return {
        clientName: row.client_name,
        invoiceNo: row.invoice_no,
        invoiceDate: row.invoice_date,
        dueDate: row.due_date,
        phoneNumber: row.phone_number,
        location: row.location,
        subtotal: row.subtotal,
        vatAmount: row.vat_amount,
        totalAmount: row.total_amount,
        description: row.description,
        trn: row.trn,
    };
}

function monthKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Last `count` months (oldest first), as {key: "2026-01", label: "Jan 2026"} —
// generated from the real current date rather than a hardcoded month list.
function lastMonths(count) {
    const months = [];
    const now = new Date();

    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
            label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        });
    }

    return months;
}

class DashboardRepository {

    // BUG-04 fix: when no document_type filter is given, the frontend's
    // "Total Invoices"/"Total Expenses" cards (Analytics.jsx) used to read
    // totalInvoices/totalExpenses computed by blending Supplier Invoices
    // (revenue you issued) and Bills (real expenses you owe) into one
    // COUNT(*)/SUM(total_amount) — e.g. a $1,000 invoice + a $500 bill
    // showed as "$1,500 Total Expenses". totalInvoices/totalExpenses are
    // now genuinely scoped (invoices-only count, bills-only value) by
    // default; the separate all-types blended figures the Dashboard page's
    // "Total Documents"/"Total Value" cards actually want are preserved
    // under their own totalDocuments/totalValue fields instead. When a
    // document_type filter IS explicitly given (e.g. Analytics.jsx's
    // dropdown), that's a deliberate single-category view, not blending —
    // totalInvoices/totalExpenses simply mirror the filtered totalDocuments/
    // totalValue, same as before this fix.
    async getSummary(companyId, clientId = null, documentType = null) {

        const invoiceParams = [companyId];
        let clientFilter = "";

        if (clientId) {
            clientFilter += " AND customer_id = ?";
            invoiceParams.push(clientId);
        }

        if (documentType) {
            clientFilter += " AND document_type = ?";
            invoiceParams.push(documentType);
        }

        // Builds one SELECT column: a plain aggregate over every matched
        // row, or (period/type given) the same aggregate restricted to a
        // created_at window and/or a document_type — but only when
        // `documentType` wasn't already passed in as an explicit filter,
        // since the WHERE clause above already scopes every row to it in
        // that case, and re-scoping here would zero out the type-scoped
        // columns whenever a *different* type was explicitly selected.
        const periodCondition = {
            month: "YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())",
            prevMonth:
                "YEAR(created_at) = YEAR(CURDATE() - INTERVAL 1 MONTH) AND MONTH(created_at) = MONTH(CURDATE() - INTERVAL 1 MONTH)",
        };

        // "supplier_invoice" is treated as "anything that isn't a bill"
        // (including a NULL document_type) rather than a strict equality —
        // invoices predating the Invoice/Bill split (migration 0005) were
        // never backfilled with a type and still need to count as revenue,
        // not silently disappear from both totals. "bill" stays an exact
        // match since it's never ambiguous — it didn't exist before that
        // migration, so nothing legacy could already be one.
        const typeCondition = {
            supplier_invoice: "(document_type != 'bill' OR document_type IS NULL)",
            bill: "document_type = 'bill'",
        };

        function scopedAggregate(fn, column, alias, { period, type } = {}) {
            const conditions = [
                period ? periodCondition[period] : null,
                type && !documentType ? typeCondition[type] : null,
            ].filter(Boolean);

            if (!conditions.length) {
                return `${fn}(${column}) AS ${alias}`;
            }

            const when = `CASE WHEN ${conditions.join(" AND ")} THEN ${column} END`;
            return fn === "COUNT" ? `COUNT(${when}) AS ${alias}` : `COALESCE(${fn}(${when}), 0) AS ${alias}`;
        }

        const countSql = (alias, opts) => scopedAggregate("COUNT", "1", alias, opts);
        const sumSql = (column, alias, opts) => scopedAggregate("SUM", column, alias, opts);
        const avgSql = (column, alias, opts) => scopedAggregate("AVG", column, alias, opts);

        const [[invoiceRow]] = await db.execute(
            `
            SELECT
                ${countSql("totalDocuments")},
                ${sumSql("total_amount", "totalValue")},
                ${sumSql("vat_amount", "totalVAT")},
                ${avgSql("total_amount", "avgInvoiceValue")},
                ${countSql("totalInvoices", { type: "supplier_invoice" })},
                ${sumSql("total_amount", "totalExpenses", { type: "bill" })},

                ${countSql("monthlyDocuments", { period: "month" })},
                ${sumSql("total_amount", "monthlyValue", { period: "month" })},
                ${sumSql("vat_amount", "monthlyVAT", { period: "month" })},
                ${avgSql("total_amount", "monthlyAvgInvoiceValue", { period: "month" })},
                ${countSql("monthlyInvoices", { period: "month", type: "supplier_invoice" })},
                ${sumSql("total_amount", "monthlyExpenses", { period: "month", type: "bill" })},

                ${countSql("prevMonthDocuments", { period: "prevMonth" })},
                ${sumSql("total_amount", "prevMonthValue", { period: "prevMonth" })},
                ${sumSql("vat_amount", "prevMonthVAT", { period: "prevMonth" })},
                ${avgSql("total_amount", "prevMonthAvgInvoiceValue", { period: "prevMonth" })},
                ${countSql("prevMonthInvoices", { period: "prevMonth", type: "supplier_invoice" })},
                ${sumSql("total_amount", "prevMonthExpenses", { period: "prevMonth", type: "bill" })}
            FROM invoices
            WHERE company_id = ? ${clientFilter}
            `,
            invoiceParams
        );

        // "Total Clients" is inherently a whole-account metric — skip it
        // entirely when scoped to a single client rather than reporting
        // something meaningless like "1".
        if (clientId) {
            return { ...invoiceRow, totalClients: null, monthlyClients: null, prevMonthClients: null };
        }

        const [[clientRow]] = await db.execute(
            `
            SELECT
                COUNT(*) AS totalClients,
                COUNT(CASE WHEN YEAR(created_at) = YEAR(CURDATE())
                            AND MONTH(created_at) = MONTH(CURDATE())
                           THEN 1 END) AS monthlyClients,
                COUNT(CASE WHEN YEAR(created_at) = YEAR(CURDATE() - INTERVAL 1 MONTH)
                            AND MONTH(created_at) = MONTH(CURDATE() - INTERVAL 1 MONTH)
                           THEN 1 END) AS prevMonthClients
            FROM customers
            WHERE company_id = ?
            `,
            [companyId]
        );

        return { ...invoiceRow, ...clientRow };
    }

    async getMonthly(companyId, monthCount = 12, clientId = null) {

        const months = lastMonths(monthCount);
        const earliest = `${months[0].key}-01`;
        const clientFilter = clientId ? "AND customer_id = ?" : "";
        const invoiceParams = clientId
            ? [companyId, earliest, clientId]
            : [companyId, earliest];

        const [invoiceRows] = await db.execute(
            `
            SELECT
                DATE_FORMAT(created_at, '%Y-%m') AS monthKey,
                COUNT(*) AS processed,
                COALESCE(SUM(total_amount), 0) AS totalAmount,
                COALESCE(SUM(vat_amount), 0) AS vatAmount
            FROM invoices
            WHERE company_id = ? AND created_at >= ? ${clientFilter}
            GROUP BY monthKey
            `,
            invoiceParams
        );

        const [failureRows] = await db.execute(
            `
            SELECT
                DATE_FORMAT(created_at, '%Y-%m') AS monthKey,
                COUNT(*) AS failed
            FROM audit_logs
            WHERE company_id = ? AND created_at >= ?
              AND action IN ('invoice_rejected', 'invoice_error') ${clientFilter}
            GROUP BY monthKey
            `,
            invoiceParams
        );

        const [clientRows] = clientId
            ? [[]]
            : await db.execute(
                  `
            SELECT
                DATE_FORMAT(created_at, '%Y-%m') AS monthKey,
                COUNT(*) AS count
            FROM customers
            WHERE company_id = ? AND created_at >= ?
            GROUP BY monthKey
            `,
                  [companyId, earliest]
              );

        const processedByMonth = new Map(invoiceRows.map((r) => [r.monthKey, r]));
        const failedByMonth = new Map(failureRows.map((r) => [r.monthKey, r.failed]));
        const clientsByMonth = new Map(clientRows.map((r) => [r.monthKey, r.count]));

        const invoices = months.map(({ key, label }) => {
            const row = processedByMonth.get(key);
            const processed = Number(row?.processed || 0);
            const failed = Number(failedByMonth.get(key) || 0);

            return {
                month: label,
                uploaded: processed + failed,
                processed,
                failed,
                totalAmount: Number(row?.totalAmount || 0),
                vatAmount: Number(row?.vatAmount || 0),
            };
        });

        const clients = months.map(({ key, label }) => ({
            month: label,
            count: Number(clientsByMonth.get(key) || 0),
        }));

        return { invoices, clients };
    }

    async getTopClients(companyId, limit = 10) {

        const [rows] = await db.query(
            `
            SELECT
                c.id,
                c.company_name AS companyName,
                COUNT(i.id) AS invoiceCount
            FROM customers c
            LEFT JOIN invoices i ON i.customer_id = c.id AND i.company_id = c.company_id
            WHERE c.company_id = ?
            GROUP BY c.id, c.company_name
            HAVING invoiceCount > 0
            ORDER BY invoiceCount DESC
            LIMIT ?
            `,
            [companyId, limit]
        );

        return rows.map((r) => ({ ...r, invoiceCount: Number(r.invoiceCount) }));
    }

    // Single fetch of everything needed to score confidence per-invoice —
    // shared by getConfidenceDistribution, getQuality and getClientAnalytics
    // so we only ever scan the invoices table once per dashboard load.
    async _getInvoiceQualityRows(companyId, clientId = null) {

        const clientFilter = clientId ? "AND customer_id = ?" : "";
        const params = clientId ? [companyId, clientId] : [companyId];

        const [rows] = await db.execute(
            `
            SELECT
                id, customer_id, created_at,
                client_name, invoice_no, invoice_date, due_date,
                phone_number, location, subtotal, vat_amount,
                total_amount, description, trn
            FROM invoices
            WHERE company_id = ? ${clientFilter}
            `,
            params
        );

        return rows.map((row) => ({
            id: row.id,
            clientId: row.customer_id,
            createdAt: row.created_at,
            confidence: validationService.validate(toValidationShape(row)).confidence,
        }));
    }

    async getConfidenceDistribution(companyId, clientId = null) {

        const rows = await this._getInvoiceQualityRows(companyId, clientId);

        const buckets = { high: 0, medium: 0, low: 0 };

        for (const row of rows) {
            if (row.confidence >= 80) buckets.high += 1;
            else if (row.confidence >= 50) buckets.medium += 1;
            else buckets.low += 1;
        }

        return buckets;
    }

    async getQuality(companyId, clientId = null) {

        const rows = await this._getInvoiceQualityRows(companyId, clientId);

        const totalSuccessfullyExtracted = rows.length;
        const lowConfidenceExtraction = rows.filter((r) => r.confidence < 50).length;

        const avgConfidenceScore = rows.length
            ? Math.round(rows.reduce((sum, r) => sum + r.confidence, 0) / rows.length)
            : 0;

        const clientFilter = clientId ? "AND customer_id = ?" : "";
        const failureParams = clientId ? [companyId, clientId] : [companyId];

        const [[failureRow]] = await db.execute(
            `
            SELECT
                COUNT(CASE WHEN action = 'invoice_rejected' THEN 1 END) AS failedInvoices,
                COUNT(CASE WHEN action = 'invoice_error' THEN 1 END) AS processingErrors
            FROM audit_logs
            WHERE company_id = ? ${clientFilter}
            `,
            failureParams
        );

        const failedInvoices = Number(failureRow.failedInvoices || 0);
        const processingErrors = Number(failureRow.processingErrors || 0);
        const totalAttempts = totalSuccessfullyExtracted + failedInvoices + processingErrors;

        const successRate = totalAttempts
            ? Math.round((totalSuccessfullyExtracted / totalAttempts) * 100)
            : 100;

        return {
            needsAttention: {
                failedInvoices,
                // Every upload in this app resolves synchronously within the
                // same request — nothing is ever left in a pending state, so
                // this is honestly always 0 rather than a broken metric.
                pendingOCR: 0,
                lowConfidenceExtraction,
                processingErrors,
            },
            accuracy: {
                overallAccuracy: avgConfidenceScore,
                avgConfidenceScore,
                successRate,
                totalSuccessfullyExtracted,
            },
        };
    }

    async getClientAnalytics(companyId) {

        const [clients, invoiceQualityRows, failureRows] = await Promise.all([
            db.execute(
                `SELECT id, company_name AS companyName FROM customers WHERE company_id = ?`,
                [companyId]
            ).then(([rows]) => rows),
            this._getInvoiceQualityRows(companyId),
            db.execute(
                `
                SELECT customer_id AS clientId, action, created_at AS createdAt
                FROM audit_logs
                WHERE company_id = ? AND customer_id IS NOT NULL
                  AND action IN ('invoice_rejected', 'invoice_error')
                `,
                [companyId]
            ).then(([rows]) => rows),
        ]);

        const byClient = new Map();

        for (const client of clients) {
            byClient.set(client.id, {
                id: client.id,
                companyName: client.companyName,
                uploaded: 0,
                processed: 0,
                failed: 0,
                confidenceSum: 0,
                lastActive: null,
            });
        }

        for (const row of invoiceQualityRows) {
            const entry = byClient.get(row.clientId);
            if (!entry) continue;

            entry.uploaded += 1;
            entry.processed += 1;
            entry.confidenceSum += row.confidence;

            if (!entry.lastActive || row.createdAt > entry.lastActive) {
                entry.lastActive = row.createdAt;
            }
        }

        for (const row of failureRows) {
            const entry = byClient.get(row.clientId);
            if (!entry) continue;

            entry.uploaded += 1;
            entry.failed += 1;

            if (!entry.lastActive || row.createdAt > entry.lastActive) {
                entry.lastActive = row.createdAt;
            }
        }

        return Array.from(byClient.values()).map((entry) => ({
            id: entry.id,
            companyName: entry.companyName,
            uploaded: entry.uploaded,
            processed: entry.processed,
            failed: entry.failed,
            accuracy: entry.processed ? Math.round(entry.confidenceSum / entry.processed) : 0,
            lastActive: entry.lastActive,
        }));
    }

    // Category-wise totals (Supplier Invoice / Bill / Bank Statement /
    // Uncategorized) for dashboard/reporting — queryable by document_type
    // per client request. Bank statements live in their own table (not
    // invoices.document_type), so they're counted via a second query
    // rather than folded into the GROUP BY above.
    async getDocumentTypeCounts(companyId, clientId = null) {

        const clientFilter = clientId ? "AND customer_id = ?" : "";
        const params = clientId ? [companyId, clientId] : [companyId];

        const [rows] = await db.execute(
            `
            SELECT document_type AS documentType, COUNT(*) AS count
            FROM invoices
            WHERE company_id = ? ${clientFilter}
            GROUP BY document_type
            `,
            params
        );

        const [[bankStatementRow]] = await db.execute(
            `
            SELECT COUNT(*) AS count
            FROM bank_statements
            WHERE company_id = ? ${clientFilter}
            `,
            params
        );

        const counts = { supplierInvoices: 0, bills: 0, bankStatements: 0, uncategorized: 0 };
        let total = 0;

        for (const row of rows) {
            const count = Number(row.count);
            total += count;

            if (row.documentType === "supplier_invoice") counts.supplierInvoices = count;
            else if (row.documentType === "bill") counts.bills = count;
            else counts.uncategorized = count;
        }

        counts.bankStatements = Number(bankStatementRow?.count || 0);
        total += counts.bankStatements;

        return { ...counts, total };
    }

    async getActivity(companyId, limit = 15) {

        const [rows] = await db.query(
            `
            SELECT
                a.id, a.action, a.description, a.created_at AS createdAt,
                c.company_name AS clientName
            FROM audit_logs a
            LEFT JOIN customers c ON c.id = a.customer_id
            WHERE a.company_id = ?
            ORDER BY a.created_at DESC, a.id DESC
            LIMIT ?
            `,
            [companyId, limit]
        );

        return rows;
    }
}

module.exports = new DashboardRepository();
