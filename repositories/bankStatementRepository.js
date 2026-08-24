const db = require("../config/database");
const { formatDate } = require("../utils/dateUtils");

function mapBankStatement(row) {
    return {
        id: row.id,
        userId: row.user_id,
        companyId: row.company_id,
        clientId: row.client_id,

        originalFilename: row.original_filename,
        imagePath: row.image_path,
        status: row.status,
        pageCount: row.page_count,

        bankName: row.bank_name,
        accountTitle: row.account_title,
        accountNumber: row.account_number,
        iban: row.iban,
        currency: row.currency,

        fromDate: row.from_date,
        toDate: row.to_date,
        openingBalance: row.opening_balance !== null ? Number(row.opening_balance) : null,
        closingBalance: row.closing_balance !== null ? Number(row.closing_balance) : null,

        transactionCount:
            row.transaction_count !== undefined ? Number(row.transaction_count) : undefined,

        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

class BankStatementRepository {

    // Every read/write below is scoped by companyId — bank statements
    // belong to the company, not to whoever uploaded them, same rule as
    // repositories/invoiceRepository.js. userId is still recorded on the
    // row (create) for attribution only.

    async create(statement) {

        const sql = `
            INSERT INTO bank_statements (
                user_id,
                company_id,
                client_id,
                original_filename,
                image_path,
                status,
                page_count,
                bank_name,
                account_title,
                account_number,
                iban,
                currency,
                from_date,
                to_date,
                opening_balance,
                closing_balance
            )
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `;

        const values = [
            statement.userId,
            statement.companyId,
            statement.clientId ?? null,
            statement.originalFilename ?? null,
            statement.imagePath ?? null,
            statement.status || "PROCESSED",
            statement.pageCount ?? null,
            statement.bankName || null,
            statement.accountTitle || null,
            statement.accountNumber || null,
            statement.iban || null,
            statement.currency || null,
            formatDate(statement.fromDate) || null,
            formatDate(statement.toDate) || null,
            statement.openingBalance ?? null,
            statement.closingBalance ?? null,
        ];

        const [result] = await db.execute(sql, values);

        return result.insertId;
    }

    async updateImagePath(id, companyId, imagePath) {
        await db.execute(
            `UPDATE bank_statements SET image_path = ? WHERE id = ? AND company_id = ?`,
            [imagePath, id, companyId]
        );
    }

    async findById(id, companyId) {

        const sql = `
            SELECT bs.*,
                (SELECT COUNT(*) FROM bank_statement_transactions t
                 WHERE t.bank_statement_id = bs.id) AS transaction_count
            FROM bank_statements bs
            WHERE bs.id = ?
            AND bs.company_id = ?
            LIMIT 1
        `;

        const [rows] = await db.execute(sql, [id, companyId]);

        return rows.length ? mapBankStatement(rows[0]) : null;
    }

    async findByCompany(companyId, { limit = 20, offset = 0, from = null, to = null } = {}) {

        let sql = `SELECT * FROM bank_statements WHERE company_id = ?`;
        const params = [companyId];

        if (from) {
            sql += ` AND created_at >= ?`;
            params.push(`${formatDate(from) || from} 00:00:00`);
        }

        if (to) {
            sql += ` AND created_at <= ?`;
            params.push(`${formatDate(to) || to} 23:59:59`);
        }

        sql += ` ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const [rows] = await db.query(sql, params);

        return rows.map(mapBankStatement);
    }

    async countByCompany(companyId, { from = null, to = null } = {}) {

        let sql = `SELECT COUNT(*) AS total FROM bank_statements WHERE company_id = ?`;
        const params = [companyId];

        if (from) {
            sql += ` AND created_at >= ?`;
            params.push(`${formatDate(from) || from} 00:00:00`);
        }

        if (to) {
            sql += ` AND created_at <= ?`;
            params.push(`${formatDate(to) || to} 23:59:59`);
        }

        const [rows] = await db.execute(sql, params);

        return Number(rows[0]?.total || 0);
    }

    async findByClient(companyId, clientId, { limit = 20, offset = 0, from = null, to = null } = {}) {

        let sql = `SELECT * FROM bank_statements WHERE company_id = ? AND client_id = ?`;
        const params = [companyId, clientId];

        if (from) {
            sql += ` AND created_at >= ?`;
            params.push(`${formatDate(from) || from} 00:00:00`);
        }

        if (to) {
            sql += ` AND created_at <= ?`;
            params.push(`${formatDate(to) || to} 23:59:59`);
        }

        sql += ` ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const [rows] = await db.query(sql, params);

        return rows.map(mapBankStatement);
    }

    async countByClient(companyId, clientId, { from = null, to = null } = {}) {

        let sql = `SELECT COUNT(*) AS total FROM bank_statements WHERE company_id = ? AND client_id = ?`;
        const params = [companyId, clientId];

        if (from) {
            sql += ` AND created_at >= ?`;
            params.push(`${formatDate(from) || from} 00:00:00`);
        }

        if (to) {
            sql += ` AND created_at <= ?`;
            params.push(`${formatDate(to) || to} 23:59:59`);
        }

        const [rows] = await db.execute(sql, params);

        return Number(rows[0]?.total || 0);
    }

    // Statement-level field edits only — transactions are edited/managed
    // separately via bankStatementTransactionRepository.
    async update(id, companyId, statement) {

        const sql = `
            UPDATE bank_statements SET
                bank_name = ?,
                account_title = ?,
                account_number = ?,
                iban = ?,
                currency = ?,
                from_date = ?,
                to_date = ?,
                opening_balance = ?,
                closing_balance = ?
            WHERE id = ?
            AND company_id = ?
        `;

        const values = [
            statement.bankName ?? null,
            statement.accountTitle ?? null,
            statement.accountNumber ?? null,
            statement.iban ?? null,
            statement.currency ?? null,
            formatDate(statement.fromDate) || null,
            formatDate(statement.toDate) || null,
            statement.openingBalance ?? null,
            statement.closingBalance ?? null,
            id,
            companyId,
        ];

        const [result] = await db.execute(sql, values);

        return result.affectedRows;
    }

    // Cascades to bank_statement_transactions via ON DELETE CASCADE.
    async deleteById(id, companyId) {

        const [result] = await db.execute(
            `DELETE FROM bank_statements WHERE id = ? AND company_id = ?`,
            [id, companyId]
        );

        return result.affectedRows;
    }

    async getStatistics(companyId) {

        const [rows] = await db.execute(
            `SELECT COUNT(*) AS totalBankStatements FROM bank_statements WHERE company_id = ?`,
            [companyId]
        );

        return {
            totalBankStatements: Number(rows[0]?.totalBankStatements || 0),
        };
    }
}

module.exports = new BankStatementRepository();
