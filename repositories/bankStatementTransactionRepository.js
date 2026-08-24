const db = require("../config/database");
const { formatDate } = require("../utils/dateUtils");

const SORT_COLUMNS = {
    transaction_date: "t.transaction_date",
    credit: "t.credit",
    debit: "t.debit",
    available_balance: "t.available_balance",
    id: "t.id",
};

const BATCH_SIZE = 500;

function mapTransaction(row) {
    return {
        id: row.id,
        bankStatementId: row.bank_statement_id,
        transactionDate: row.transaction_date,
        description: row.description,
        credit: Number(row.credit),
        debit: Number(row.debit),
        availableBalance: row.available_balance !== null ? Number(row.available_balance) : null,
        referenceNo: row.reference_no,
        pageNumber: row.page_number,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function buildFilterClause({ search, from, to, hasCredit, hasDebit } = {}, params) {

    let clause = "";

    if (search) {
        clause += ` AND (t.description LIKE ? OR t.reference_no LIKE ?)`;
        const like = `%${search}%`;
        params.push(like, like);
    }

    if (from) {
        clause += ` AND t.transaction_date >= ?`;
        params.push(formatDate(from) || from);
    }

    if (to) {
        clause += ` AND t.transaction_date <= ?`;
        params.push(formatDate(to) || to);
    }

    if (hasCredit === true) {
        clause += ` AND t.credit > 0`;
    } else if (hasCredit === false) {
        clause += ` AND t.credit = 0`;
    }

    if (hasDebit === true) {
        clause += ` AND t.debit > 0`;
    } else if (hasDebit === false) {
        clause += ` AND t.debit = 0`;
    }

    return clause;
}

class BankStatementTransactionRepository {

    // The transactions table has no company_id column of its own, so every
    // query here joins bank_statements and scopes on bs.company_id — the
    // same "bake ownership into the SQL" pattern used elsewhere in the app,
    // applied through the parent row. Without this join, a transaction id
    // alone would let one company read another company's rows (IDOR).

    async createMany(bankStatementId, transactions = []) {

        if (!transactions.length) {
            return;
        }

        for (let i = 0; i < transactions.length; i += BATCH_SIZE) {

            const batch = transactions.slice(i, i + BATCH_SIZE);

            const rows = batch.map((t) => [
                bankStatementId,
                formatDate(t.transactionDate) || null,
                t.description || "",
                t.credit || 0,
                t.debit || 0,
                t.availableBalance ?? null,
                t.referenceNo ?? null,
                t.pageNumber ?? null,
            ]);

            await db.query(
                `INSERT INTO bank_statement_transactions (
                    bank_statement_id,
                    transaction_date,
                    description,
                    credit,
                    debit,
                    available_balance,
                    reference_no,
                    page_number
                ) VALUES ?`,
                [rows]
            );
        }
    }

    async findByStatement(bankStatementId, companyId, {
        page = 1,
        pageSize = 50,
        sortBy = "id",
        sortDir = "asc",
        search = null,
        from = null,
        to = null,
        hasCredit = null,
        hasDebit = null,
    } = {}) {

        const sortColumn = SORT_COLUMNS[sortBy] || SORT_COLUMNS.id;
        const direction = String(sortDir).toLowerCase() === "desc" ? "DESC" : "ASC";

        let sql = `
            SELECT t.*
            FROM bank_statement_transactions t
            INNER JOIN bank_statements bs ON bs.id = t.bank_statement_id AND bs.company_id = ?
            WHERE t.bank_statement_id = ?
        `;

        const params = [companyId, bankStatementId];

        sql += buildFilterClause({ search, from, to, hasCredit, hasDebit }, params);

        sql += ` ORDER BY ${sortColumn} ${direction}, t.id ${direction} LIMIT ? OFFSET ?`;
        params.push(pageSize, (page - 1) * pageSize);

        const [rows] = await db.query(sql, params);

        return rows.map(mapTransaction);
    }

    async countByStatement(bankStatementId, companyId, {
        search = null,
        from = null,
        to = null,
        hasCredit = null,
        hasDebit = null,
    } = {}) {

        let sql = `
            SELECT COUNT(*) AS total
            FROM bank_statement_transactions t
            INNER JOIN bank_statements bs ON bs.id = t.bank_statement_id AND bs.company_id = ?
            WHERE t.bank_statement_id = ?
        `;

        const params = [companyId, bankStatementId];

        sql += buildFilterClause({ search, from, to, hasCredit, hasDebit }, params);

        const [rows] = await db.query(sql, params);

        return Number(rows[0]?.total || 0);
    }
}

module.exports = new BankStatementTransactionRepository();
