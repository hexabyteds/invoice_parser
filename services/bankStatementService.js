const fs = require("fs");

const bankStatementExtractionService = require("./bankStatementExtractionService");
const usageService = require("./usageService");
const pdfService = require("./pdfService");

const bankStatementRepository = require("../repositories/bankStatementRepository");
const bankStatementTransactionRepository = require("../repositories/bankStatementTransactionRepository");

const {
    toStoredSourcePath,
    resolveUploadPath,
    deleteStoredFileAndGetSize
} = require("../utils/uploadPaths");

const { formatDate } = require("../utils/dateUtils");

class BankStatementService {

    // =========================
    // IMAGE
    // =========================

    async processImage(imagePath, userId, clientId, sourceFilePath = imagePath) {

        // Reserve OCR quota atomically before Gemini — same pool/limit as
        // invoices (real Gemini page cost), refunded on failure below.
        await usageService.reserveOCRPages(userId, 1);

        const result = await bankStatementExtractionService.extractImage(imagePath);

        if (!result.success) {
            await usageService.decrementOCR(userId, 1);

            return {
                status: "error",
                message: result.error || "Bank statement extraction failed."
            };
        }

        const storedPath = toStoredSourcePath(sourceFilePath);

        const statementId = await bankStatementRepository.create({
            userId,
            clientId,
            originalFilename: sourceFilePath ? sourceFilePath.split("/").pop() : null,
            imagePath: storedPath,
            status: "PROCESSED",
            pageCount: 1,
            ...result.statement
        });

        await bankStatementTransactionRepository.createMany(statementId, result.transactions);

        // No plan limit gates bank statements yet — a simple increment on
        // successful creation, no reservation/refund dance needed.
        await usageService.incrementBankStatements(userId);

        const bankStatement = await bankStatementRepository.findById(statementId, userId);

        return {
            status: "success",
            bankStatement,
            transactionCount: result.transactions.length
        };
    }

    // =========================
    // PDF
    // =========================

    async processPDF(pdfPath, userId, clientId, sourceFilePath = pdfPath) {

        const pageCount = await pdfService.getPageCount(pdfPath);

        // Reserve the maximum possible OCR usage before Gemini processing;
        // failed chunks are refunded below, mirroring free-invoice-agent.js.
        await usageService.reserveOCRPages(userId, pageCount);

        let result;

        try {
            result = await bankStatementExtractionService.extractPDF(pdfPath);
        } catch (err) {
            await usageService.decrementOCR(userId, pageCount);
            throw err;
        }

        if (!result.success) {
            await usageService.decrementOCR(userId, pageCount);

            return {
                status: "error",
                message: result.error,
                errors: result.errors || [],
                meta: result.meta || { pageCount }
            };
        }

        let failedPages = 0;

        if (Array.isArray(result.errors)) {
            for (const error of result.errors) {
                if (
                    Number.isInteger(error.pageStart) &&
                    Number.isInteger(error.pageEnd) &&
                    error.pageEnd >= error.pageStart
                ) {
                    failedPages += error.pageEnd - error.pageStart + 1;
                } else {
                    failedPages += 1;
                }
            }
        }

        failedPages = Math.min(failedPages, pageCount);

        if (failedPages > 0) {
            await usageService.decrementOCR(userId, failedPages);
        }

        const storedPath = toStoredSourcePath(sourceFilePath);

        let statementId;

        try {
            statementId = await bankStatementRepository.create({
                userId,
                clientId,
                originalFilename: sourceFilePath ? sourceFilePath.split("/").pop() : null,
                imagePath: storedPath,
                status: "PROCESSED",
                pageCount,
                ...result.statement
            });

            await bankStatementTransactionRepository.createMany(statementId, result.transactions);

            await usageService.incrementBankStatements(userId);

        } catch (err) {
            // Extraction succeeded but persistence failed — OCR stays
            // consumed because Gemini successfully processed the document
            // (same reasoning as free-invoice-agent.js).
            throw err;
        }

        const bankStatement = await bankStatementRepository.findById(statementId, userId);

        return {
            status: "success",
            bankStatement,
            transactionCount: result.transactions.length,
            errors: result.errors || [],
            meta: {
                ...(result.meta || {}),
                pageCount,
                failedPages,
                successfulPages: pageCount - failedPages,
                partialFailure: failedPages > 0
            }
        };
    }

    // =========================
    // READ
    // =========================

    async getById(id, userId) {
        return await bankStatementRepository.findById(id, userId);
    }

    async getSourcePath(id, userId) {

        const statement = await bankStatementRepository.findById(id, userId);

        if (!statement?.imagePath) {
            return null;
        }

        const absolutePath = resolveUploadPath(statement.imagePath);

        if (!absolutePath || !fs.existsSync(absolutePath)) {
            return null;
        }

        return {
            absolutePath,
            storedPath: statement.imagePath
        };
    }

    async getTransactions(statementId, userId, filters = {}) {

        const statement = await bankStatementRepository.findById(statementId, userId);

        if (!statement) {
            return null;
        }

        const page = Math.max(1, Number(filters.page) || 1);
        const pageSize = Math.min(200, Math.max(1, Number(filters.pageSize) || 50));

        const [transactions, total] = await Promise.all([
            bankStatementTransactionRepository.findByStatement(statementId, userId, {
                ...filters,
                page,
                pageSize
            }),

            bankStatementTransactionRepository.countByStatement(statementId, userId, filters)
        ]);

        return {
            transactions,
            pagination: {
                total,
                page,
                pageSize,
                hasMore: page * pageSize < total
            }
        };
    }

    // =========================
    // UPDATE / DELETE
    // =========================

    async update(id, userId, data) {

        const existing = await bankStatementRepository.findById(id, userId);

        if (!existing) {
            return null;
        }

        const dateFields = ["fromDate", "toDate"];

        for (const field of dateFields) {
            if (!data[field]) continue;

            if (!formatDate(data[field])) {
                throw new Error(`Invalid value for ${field}: must be a valid date.`);
            }
        }

        const numericFields = ["openingBalance", "closingBalance"];

        for (const field of numericFields) {
            if (data[field] === undefined || data[field] === null) continue;

            if (Number.isNaN(Number(data[field]))) {
                throw new Error(`Invalid value for ${field}: must be a number.`);
            }
        }

        const merged = {
            bankName: data.bankName ?? existing.bankName,
            accountTitle: data.accountTitle ?? existing.accountTitle,
            accountNumber: data.accountNumber ?? existing.accountNumber,
            iban: data.iban ?? existing.iban,
            currency: data.currency ?? existing.currency,
            fromDate: data.fromDate ?? existing.fromDate,
            toDate: data.toDate ?? existing.toDate,
            openingBalance: data.openingBalance ?? existing.openingBalance,
            closingBalance: data.closingBalance ?? existing.closingBalance
        };

        await bankStatementRepository.update(id, userId, merged);

        return await bankStatementRepository.findById(id, userId);
    }

    async deleteById(id, userId) {

        const existing = await bankStatementRepository.findById(id, userId);

        if (!existing) {
            return false;
        }

        // Transactions cascade via ON DELETE CASCADE.
        const removed = await bankStatementRepository.deleteById(id, userId);

        if (removed > 0) {
            await usageService.decrementBankStatements(userId);

            // Same storage-quota-never-released gap as invoice deletion —
            // reclaim the file and its bytes now (see deleteStoredFileAndGetSize
            // for why this is based on the file's real current size).
            if (existing.imagePath) {
                const freedBytes =
                    await deleteStoredFileAndGetSize(existing.imagePath);

                if (freedBytes > 0) {
                    await usageService.removeStorage(userId, freedBytes);
                }
            }
        }

        return removed > 0;
    }
}

module.exports = new BankStatementService();
