const path = require("path");

const bankStatementService = require("../services/bankStatementService");

const MIME_BY_EXT = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
};

function parseBoolParam(value) {
    if (value === undefined) return null;
    if (value === "true") return true;
    if (value === "false") return false;
    return null;
}

class BankStatementController {

    async get(req, res) {

        try {

            const statement = await bankStatementService.getById(
                req.params.id,
                req.company.id
            );

            if (!statement) {
                return res.status(404).json({
                    success: false,
                    error: "Bank statement not found."
                });
            }

            res.json({
                success: true,
                bankStatement: statement
            });

        } catch (err) {

            res.status(500).json({
                success: false,
                error: err.message
            });

        }
    }

    async getSource(req, res) {

        try {

            const source = await bankStatementService.getSourcePath(
                req.params.id,
                req.company.id
            );

            if (!source) {
                return res.status(404).json({
                    success: false,
                    error: "Bank statement source file not found."
                });
            }

            const ext = path.extname(source.absolutePath).toLowerCase();

            res.type(MIME_BY_EXT[ext] || "application/octet-stream");
            res.sendFile(source.absolutePath);

        } catch (err) {

            res.status(500).json({
                success: false,
                error: err.message
            });

        }
    }

    async getTransactions(req, res) {

        try {

            const MAX_PAGE_SIZE = 200;

            const page = req.query.page !== undefined ? Number(req.query.page) : 1;
            const pageSize = req.query.pageSize !== undefined ? Number(req.query.pageSize) : 50;

            if (!Number.isSafeInteger(page) || page < 1) {
                return res.status(400).json({
                    success: false,
                    error: "page must be a positive integer"
                });
            }

            if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
                return res.status(400).json({
                    success: false,
                    error: `pageSize must be an integer between 1 and ${MAX_PAGE_SIZE}`
                });
            }

            const sortBy = req.query.sortBy || "id";
            const sortDir = req.query.sortDir || "asc";

            const from = req.query.from || null;
            const to = req.query.to || null;

            if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
                return res.status(400).json({
                    success: false,
                    error: "from must be a date in YYYY-MM-DD format"
                });
            }

            if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
                return res.status(400).json({
                    success: false,
                    error: "to must be a date in YYYY-MM-DD format"
                });
            }

            const result = await bankStatementService.getTransactions(
                req.params.id,
                req.company.id,
                {
                    page,
                    pageSize,
                    sortBy,
                    sortDir,
                    search: req.query.search || null,
                    from,
                    to,
                    hasCredit: parseBoolParam(req.query.hasCredit),
                    hasDebit: parseBoolParam(req.query.hasDebit),
                }
            );

            if (!result) {
                return res.status(404).json({
                    success: false,
                    error: "Bank statement not found."
                });
            }

            res.json({
                success: true,
                transactions: result.transactions,
                pagination: result.pagination
            });

        } catch (err) {

            res.status(500).json({
                success: false,
                error: err.message
            });

        }
    }

    async update(req, res) {

        try {

            const updated = await bankStatementService.update(
                req.params.id,
                req.company.id,
                req.body
            );

            if (!updated) {
                return res.status(404).json({
                    success: false,
                    error: "Bank statement not found."
                });
            }

            res.json({
                success: true,
                bankStatement: updated
            });

        } catch (err) {

            const status = err.message?.includes("Invalid value") ? 400 : 500;

            res.status(status).json({
                success: false,
                error: err.message
            });

        }
    }

    async delete(req, res) {

        try {

            const removed = await bankStatementService.deleteById(
                req.params.id,
                req.company.id
            );

            if (!removed) {
                return res.status(404).json({
                    success: false,
                    error: "Bank statement not found."
                });
            }

            res.json({
                success: true,
                message: "Bank statement deleted."
            });

        } catch (err) {

            res.status(500).json({
                success: false,
                error: err.message
            });

        }
    }
}

module.exports = new BankStatementController();
