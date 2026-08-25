const db = require("../config/database");
const { formatDate } = require("../utils/dateUtils");

function mapBankStatement(row) {
    return {
        id: row.id,
        userId: row.user_id,
        clientId: row.customer_id,

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

    // Every method here takes userId explicitly and bakes
    // "WHERE user_id = ?" into the SQL itself — same ownership pattern as
    // repositories/invoiceRepository.js, to avoid IDOR.

    async create(statement) {

        const sql = `
            INSERT INTO bank_statements (
                user_id,
                customer_id,
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
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `;

        const values = [
            statement.userId,
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

    async updateImagePath(id, userId, imagePath) {
        await db.execute(
            `UPDATE bank_statements SET image_path = ? WHERE id = ? AND user_id = ?`,
            [imagePath, id, userId]
        );
    }

    async findById(id, userId) {

        const sql = `
            SELECT bs.*,
                (SELECT COUNT(*) FROM bank_statement_transactions t
                 WHERE t.bank_statement_id = bs.id) AS transaction_count
            FROM bank_statements bs
            WHERE bs.id = ?
            AND bs.user_id = ?
            LIMIT 1
        `;

        const [rows] = await db.execute(sql, [id, userId]);

        return rows.length ? mapBankStatement(rows[0]) : null;
    }

    async findByUser(userId, { limit = 20, offset = 0, from = null, to = null } = {}) {

        let sql = `SELECT * FROM bank_statements WHERE user_id = ?`;
        const params = [userId];

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

    async countByUser(userId, { from = null, to = null } = {}) {

        let sql = `SELECT COUNT(*) AS total FROM bank_statements WHERE user_id = ?`;
        const params = [userId];

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

    async findByClient(userId, clientId, { limit = 20, offset = 0, from = null, to = null } = {}) {

        let sql = `SELECT * FROM bank_statements WHERE user_id = ? AND customer_id = ?`;
        const params = [userId, clientId];

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

    async countByClient(userId, clientId, { from = null, to = null } = {}) {

        let sql = `SELECT COUNT(*) AS total FROM bank_statements WHERE user_id = ? AND customer_id = ?`;
        const params = [userId, clientId];

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
    async update(id, userId, statement) {

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
            AND user_id = ?
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
            userId,
        ];

        const [result] = await db.execute(sql, values);

        return result.affectedRows;
    }

    // Cascades to bank_statement_transactions via ON DELETE CASCADE.
    async deleteById(id, userId) {

        const [result] = await db.execute(
            `DELETE FROM bank_statements WHERE id = ? AND user_id = ?`,
            [id, userId]
        );

        return result.affectedRows;
    }

    async getStatistics(userId) {

        const [rows] = await db.execute(
            `SELECT COUNT(*) AS totalBankStatements FROM bank_statements WHERE user_id = ?`,
            [userId]
        );

        return {
            totalBankStatements: Number(rows[0]?.totalBankStatements || 0),
        };
    }
}

module.exports = new BankStatementRepository();
