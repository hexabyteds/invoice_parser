const GeminiService = require("./geminiService");
const pdfService = require("./pdfService");

// The real constraint for large bank statements is Gemini's ~65k output
// token ceiling (a dense transaction table), not the ~1M input context —
// so a statement can afford a bigger chunk size than the invoice pipeline's
// GEMINI_PDF_CHUNK_PAGES, but still needs chunking once pages/transactions
// get numerous enough to risk MAX_TOKENS truncation. Read per-call (not
// cached at module load) so it can be tuned/tested without a process restart.
function getChunkPages() {
    return Math.max(1, Number(process.env.GEMINI_BANK_STATEMENT_CHUNK_PAGES) || 6);
}

function mapGeminiTransaction(g) {
    return {
        transactionDate: g.transactionDate || null,
        description: g.description || "",
        credit: Number(g.credit) || 0,
        debit: Number(g.debit) || 0,
        availableBalance:
            g.availableBalance !== undefined && g.availableBalance !== null
                ? Number(g.availableBalance)
                : null,
        referenceNo: g.referenceNo || null,
        continuesFromPreviousChunk: Boolean(g.continuesFromPreviousChunk),
        continuesToNextChunk: Boolean(g.continuesToNextChunk),
    };
}

function firstNonEmptyString(chunkResults, field) {
    for (const c of chunkResults) {
        const v = c.statement?.[field];
        if (typeof v === "string" && v.trim() !== "") {
            return v;
        }
    }
    return "";
}

function lastNonEmptyString(chunkResults, field) {
    for (let i = chunkResults.length - 1; i >= 0; i--) {
        const v = chunkResults[i].statement?.[field];
        if (typeof v === "string" && v.trim() !== "") {
            return v;
        }
    }
    return "";
}

/**
 * Statement-level fields (bank name, account info, opening balance) cluster
 * on the first page/chunk; closing balance and the statement end date
 * cluster on the last. Scanning for the first/last non-empty value (rather
 * than only ever trusting chunk[0]/chunk[last]) tolerates a header block
 * that spills onto a second page.
 */
function mergeStatementFields(chunkResults) {
    return {
        bankName: firstNonEmptyString(chunkResults, "bankName"),
        accountTitle: firstNonEmptyString(chunkResults, "accountTitle"),
        accountNumber: firstNonEmptyString(chunkResults, "accountNumber"),
        iban: firstNonEmptyString(chunkResults, "iban"),
        currency: firstNonEmptyString(chunkResults, "currency"),
        fromDate: firstNonEmptyString(chunkResults, "fromDate"),
        toDate: lastNonEmptyString(chunkResults, "toDate"),
        openingBalance: chunkResults[0]?.statement?.openingBalance,
        closingBalance:
            chunkResults[chunkResults.length - 1]?.statement?.closingBalance,
    };
}

function mapGeminiStatement(g) {
    return {
        bankName: g.bankName || null,
        accountTitle: g.accountTitle || null,
        accountNumber: g.accountNumber || null,
        iban: g.iban || null,
        currency: g.currency || null,
        fromDate: g.fromDate || null,
        toDate: g.toDate || null,
        openingBalance:
            g.openingBalance !== undefined && g.openingBalance !== null
                ? Number(g.openingBalance)
                : null,
        closingBalance:
            g.closingBalance !== undefined && g.closingBalance !== null
                ? Number(g.closingBalance)
                : null,
    };
}

function flattenTaggedTransactions(chunkResults) {
    const flat = [];

    for (const c of chunkResults) {
        for (const t of c.transactions) {
            flat.push({ ...t, _pageStart: c.pageStart, _pageEnd: c.pageEnd });
        }
    }

    return flat;
}

/**
 * Stitches a transaction whose description/amounts were split across a
 * chunk boundary back into one row. Chunks never overlap, so this only
 * ever joins two adjacent partial fragments — it never needs to
 * deduplicate re-seen rows.
 */
function mergeBoundaryTransactions(flat) {
    const merged = [];
    let i = 0;

    while (i < flat.length) {
        const current = flat[i];
        const next = flat[i + 1];

        if (current.continuesToNextChunk && next && next.continuesFromPreviousChunk) {
            merged.push({
                transactionDate: current.transactionDate || next.transactionDate,
                description: [current.description, next.description]
                    .filter(Boolean)
                    .join(" ")
                    .trim(),
                credit: current.credit || next.credit,
                debit: current.debit || next.debit,
                // Gemini's "missing" sentinel for a required numeric field
                // is 0, not null (see mapGeminiTransaction) — so this must
                // treat 0 as "no value here" the same way credit/debit do
                // above, not just null/undefined.
                availableBalance:
                    current.availableBalance || next.availableBalance,
                referenceNo: current.referenceNo || next.referenceNo,
                _pageStart: current._pageStart,
                _pageEnd: next._pageEnd,
            });

            i += 2;
        } else {
            merged.push(current);
            i += 1;
        }
    }

    return merged;
}

function mergeTransactions(chunkResults) {
    const flat = flattenTaggedTransactions(chunkResults);
    const merged = mergeBoundaryTransactions(flat);

    return merged.map((t) => ({
        transactionDate: t.transactionDate,
        description: t.description,
        credit: t.credit,
        debit: t.debit,
        availableBalance: t.availableBalance,
        referenceNo: t.referenceNo,
        pageNumber: t._pageStart ?? null,
    }));
}

class BankStatementExtractionService {

    async extractImage(imagePath) {
        const result = await GeminiService.extractBankStatement(imagePath);

        if (!result.success) {
            return result;
        }

        return {
            success: true,
            statement: mapGeminiStatement(result.statement),
            transactions: (result.transactions || []).map((t) => {
                const mapped = mapGeminiTransaction(t);
                return {
                    transactionDate: mapped.transactionDate,
                    description: mapped.description,
                    credit: mapped.credit,
                    debit: mapped.debit,
                    availableBalance: mapped.availableBalance,
                    referenceNo: mapped.referenceNo,
                    pageNumber: 1,
                };
            }),
        };
    }

    async extractPDF(pdfPath) {

        const pageCount = await pdfService.getPageCount(pdfPath);
        const chunkPages = getChunkPages();

        let chunkFiles = [{ file: pdfPath }];
        let tempDir = null;

        if (pageCount > chunkPages) {
            const built = await pdfService.buildChunks(pdfPath, chunkPages);

            chunkFiles = built.chunks;
            tempDir = built.tempDir;

            console.log(
                `[PDF] Bank statement: ${pageCount} pages → ${chunkFiles.length} Gemini requests ` +
                `(max ${chunkPages} pages/request)`
            );
        }

        const chunkResults = [];
        const errors = [];

        try {

            for (let i = 0; i < chunkFiles.length; i++) {

                const chunk = chunkFiles[i];
                const label = chunk.pageStart
                    ? `pages ${chunk.pageStart}-${chunk.pageEnd}`
                    : "full file";

                console.log(
                    `[PDF] Bank statement Gemini chunk ${i + 1}/${chunkFiles.length} (${label})`
                );

                try {

                    const result = await GeminiService.extractBankStatement(chunk.file);

                    if (!result.success) {
                        errors.push({
                            chunk: i + 1,
                            pageStart: chunk.pageStart ?? null,
                            pageEnd: chunk.pageEnd ?? null,
                            error: result.error || "Gemini extraction failed.",
                        });
                        continue;
                    }

                    chunkResults.push({
                        statement: result.statement,
                        transactions: (result.transactions || []).map(mapGeminiTransaction),
                        pageStart: chunk.pageStart ?? 1,
                        pageEnd: chunk.pageEnd ?? pageCount,
                    });

                } catch (err) {

                    errors.push({
                        chunk: i + 1,
                        pageStart: chunk.pageStart ?? null,
                        pageEnd: chunk.pageEnd ?? null,
                        error: err.message || "Unexpected Gemini extraction error.",
                    });

                    console.error(`[PDF] Bank statement chunk ${i + 1} failed:`, err.message);
                }
            }

        } finally {

            if (tempDir) {
                pdfService.cleanupDir(tempDir);
            }

        }

        if (chunkResults.length === 0) {
            return {
                success: false,

                error:
                    errors[0]?.error ||
                    "No data could be extracted from this bank statement.",

                errors,

                meta: {
                    pageCount,
                    geminiRequests: chunkFiles.length,
                    successfulChunks: 0,
                    failedChunks: errors.length,
                    partialFailure: false,
                },
            };
        }

        const statement = mapGeminiStatement(mergeStatementFields(chunkResults));
        const transactions = mergeTransactions(chunkResults);

        return {
            success: true,

            statement,
            transactions,

            // IMPORTANT: do not discard failed chunks — surface them so the
            // caller can refund OCR pages and report a partial failure.
            errors,

            meta: {
                pageCount,
                geminiRequests: chunkFiles.length,
                successfulChunks: chunkFiles.length - errors.length,
                failedChunks: errors.length,
                partialFailure: errors.length > 0,
            },
        };
    }
}

module.exports = new BankStatementExtractionService();
