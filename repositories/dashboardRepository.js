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

    async getSummary(userId, clientId = null, documentType = null) {

        const invoiceParams = [userId];
        let clientFilter = "";

        if (clientId) {
            clientFilter += " AND client_id = ?";
            invoiceParams.push(clientId);
        }

        if (documentType) {
            clientFilter += " AND document_type = ?";
            invoiceParams.push(documentType);
        }

        const [[invoiceRow]] = await db.execute(
            `
            SELECT
                COUNT(*) AS totalInvoices,
                COALESCE(SUM(total_amount), 0) AS totalExpenses,
                COALESCE(SUM(vat_amount), 0) AS totalVAT,
                COALESCE(AVG(total_amount), 0) AS avgInvoiceValue,

                COUNT(CASE WHEN YEAR(created_at) = YEAR(CURDATE())
                            AND MONTH(created_at) = MONTH(CURDATE())
                           THEN 1 END) AS monthlyInvoices,
                COALESCE(SUM(CASE WHEN YEAR(created_at) = YEAR(CURDATE())
                                   AND MONTH(created_at) = MONTH(CURDATE())
                                  THEN total_amount END), 0) AS monthlyExpenses,
                COALESCE(SUM(CASE WHEN YEAR(created_at) = YEAR(CURDATE())
                                   AND MONTH(created_at) = MONTH(CURDATE())
                                  THEN vat_amount END), 0) AS monthlyVAT,
                COALESCE(AVG(CASE WHEN YEAR(created_at) = YEAR(CURDATE())
                                  AND MONTH(created_at) = MONTH(CURDATE())
                                  THEN total_amount END), 0) AS monthlyAvgInvoiceValue,

                COUNT(CASE WHEN YEAR(created_at) = YEAR(CURDATE() - INTERVAL 1 MONTH)
                            AND MONTH(created_at) = MONTH(CURDATE() - INTERVAL 1 MONTH)
                           THEN 1 END) AS prevMonthInvoices,
                COALESCE(SUM(CASE WHEN YEAR(created_at) = YEAR(CURDATE() - INTERVAL 1 MONTH)
                                   AND MONTH(created_at) = MONTH(CURDATE() - INTERVAL 1 MONTH)
                                  THEN total_amount END), 0) AS prevMonthExpenses,
                COALESCE(SUM(CASE WHEN YEAR(created_at) = YEAR(CURDATE() - INTERVAL 1 MONTH)
                                   AND MONTH(created_at) = MONTH(CURDATE() - INTERVAL 1 MONTH)
                                  THEN vat_amount END), 0) AS prevMonthVAT,
                COALESCE(AVG(CASE WHEN YEAR(created_at) = YEAR(CURDATE() - INTERVAL 1 MONTH)
                                  AND MONTH(created_at) = MONTH(CURDATE() - INTERVAL 1 MONTH)
                                  THEN total_amount END), 0) AS prevMonthAvgInvoiceValue
            FROM invoices
            WHERE user_id = ? ${clientFilter}
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
            FROM clients
            WHERE user_id = ?
            `,
            [userId]
        );

        return { ...invoiceRow, ...clientRow };
    }

    async getMonthly(userId, monthCount = 12, clientId = null) {

        const months = lastMonths(monthCount);
        const earliest = `${months[0].key}-01`;
        const clientFilter = clientId ? "AND client_id = ?" : "";
        const invoiceParams = clientId
            ? [userId, earliest, clientId]
            : [userId, earliest];

        const [invoiceRows] = await db.execute(
            `
            SELECT
                DATE_FORMAT(created_at, '%Y-%m') AS monthKey,
                COUNT(*) AS processed,
                COALESCE(SUM(total_amount), 0) AS totalAmount,
                COALESCE(SUM(vat_amount), 0) AS vatAmount
            FROM invoices
            WHERE user_id = ? AND created_at >= ? ${clientFilter}
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
            WHERE user_id = ? AND created_at >= ?
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
            FROM clients
            WHERE user_id = ? AND created_at >= ?
            GROUP BY monthKey
            `,
                  [userId, earliest]
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

    async getTopClients(userId, limit = 10) {

        const [rows] = await db.query(
            `
            SELECT
                c.id,
                c.company_name AS companyName,
                COUNT(i.id) AS invoiceCount
            FROM clients c
            LEFT JOIN invoices i ON i.client_id = c.id AND i.user_id = c.user_id
            WHERE c.user_id = ?
            GROUP BY c.id, c.company_name
            HAVING invoiceCount > 0
            ORDER BY invoiceCount DESC
            LIMIT ?
            `,
            [userId, limit]
        );

        return rows.map((r) => ({ ...r, invoiceCount: Number(r.invoiceCount) }));
    }

    // Single fetch of everything needed to score confidence per-invoice —
    // shared by getConfidenceDistribution, getQuality and getClientAnalytics
    // so we only ever scan the invoices table once per dashboard load.
    async _getInvoiceQualityRows(userId, clientId = null) {

        const clientFilter = clientId ? "AND client_id = ?" : "";
        const params = clientId ? [userId, clientId] : [userId];

        const [rows] = await db.execute(
            `
            SELECT
                id, client_id, created_at,
                client_name, invoice_no, invoice_date, due_date,
                phone_number, location, subtotal, vat_amount,
                total_amount, description, trn
            FROM invoices
            WHERE user_id = ? ${clientFilter}
            `,
            params
        );

        return rows.map((row) => ({
            id: row.id,
            clientId: row.client_id,
            createdAt: row.created_at,
            confidence: validationService.validate(toValidationShape(row)).confidence,
        }));
    }

    async getConfidenceDistribution(userId, clientId = null) {

        const rows = await this._getInvoiceQualityRows(userId, clientId);

        const buckets = { high: 0, medium: 0, low: 0 };

        for (const row of rows) {
            if (row.confidence >= 80) buckets.high += 1;
            else if (row.confidence >= 50) buckets.medium += 1;
            else buckets.low += 1;
        }

        return buckets;
    }

    async getQuality(userId, clientId = null) {

        const rows = await this._getInvoiceQualityRows(userId, clientId);

        const totalSuccessfullyExtracted = rows.length;
        const lowConfidenceExtraction = rows.filter((r) => r.confidence < 50).length;

        const avgConfidenceScore = rows.length
            ? Math.round(rows.reduce((sum, r) => sum + r.confidence, 0) / rows.length)
            : 0;

        const clientFilter = clientId ? "AND client_id = ?" : "";
        const failureParams = clientId ? [userId, clientId] : [userId];

        const [[failureRow]] = await db.execute(
            `
            SELECT
                COUNT(CASE WHEN action = 'invoice_rejected' THEN 1 END) AS failedInvoices,
                COUNT(CASE WHEN action = 'invoice_error' THEN 1 END) AS processingErrors
            FROM audit_logs
            WHERE user_id = ? ${clientFilter}
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

    async getClientAnalytics(userId) {

        const [clients, invoiceQualityRows, failureRows] = await Promise.all([
            db.execute(
                `SELECT id, company_name AS companyName FROM clients WHERE user_id = ?`,
                [userId]
            ).then(([rows]) => rows),
            this._getInvoiceQualityRows(userId),
            db.execute(
                `
                SELECT client_id AS clientId, action, created_at AS createdAt
                FROM audit_logs
                WHERE user_id = ? AND client_id IS NOT NULL
                  AND action IN ('invoice_rejected', 'invoice_error')
                `,
                [userId]
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

    // Category-wise totals (Supplier Invoice / Bill / Uncategorized) for
    // dashboard/reporting — queryable by document_type per client request.
    async getDocumentTypeCounts(userId, clientId = null) {

        const clientFilter = clientId ? "AND client_id = ?" : "";
        const params = clientId ? [userId, clientId] : [userId];

        const [rows] = await db.execute(
            `
            SELECT document_type AS documentType, COUNT(*) AS count
            FROM invoices
            WHERE user_id = ? ${clientFilter}
            GROUP BY document_type
            `,
            params
        );

        const counts = { supplierInvoices: 0, bills: 0, uncategorized: 0 };
        let total = 0;

        for (const row of rows) {
            const count = Number(row.count);
            total += count;

            if (row.documentType === "supplier_invoice") counts.supplierInvoices = count;
            else if (row.documentType === "bill") counts.bills = count;
            else counts.uncategorized = count;
        }

        return { ...counts, total };
    }

    async getActivity(userId, limit = 15) {

        const [rows] = await db.query(
            `
            SELECT
                a.id, a.action, a.description, a.created_at AS createdAt,
                c.company_name AS clientName
            FROM audit_logs a
            LEFT JOIN clients c ON c.id = a.client_id
            WHERE a.user_id = ?
            ORDER BY a.created_at DESC, a.id DESC
            LIMIT ?
            `,
            [userId, limit]
        );

        return rows;
    }
}

module.exports = new DashboardRepository();
