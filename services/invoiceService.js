const GeminiService = require("./geminiService");
const validationService = require("./validationService");
const pdfService = require("./pdfService");
const partyNameService = require("./partyNameService");

const DEFAULT_CHUNK_PAGES =
    Number(process.env.GEMINI_PDF_CHUNK_PAGES) || 8;

function mapGeminiInvoice(g) {
    const lineItems = (g.lineItems || []).map((i) => ({
        description: i.description || "",
        quantity: Number(i.qty) || 0,
        unitPrice: Number(i.unitPrice) || 0,
        amount: Number(i.amount) || 0,
    }));

    const invoice = {
        invoiceType: "Invoice",
        // clientName defaults to the extracted seller/vendor — used as-is
        // for the "does this look like a real document" validation check
        // below. Once document_type + the selected client are known, the
        // caller (FreeInvoiceAgent) overwrites this with the correct
        // counterparty via services/partyNameService.js.
        clientName: g.vendorName || "",
        sellerName: g.vendorName || "",
        buyerName: g.buyerName || "",
        invoiceNo: g.invoiceNumber || "",
        invoiceDate: g.invoiceDate || "",
        dueDate: g.dueDate || "",
        phoneNumber: g.phone || "",
        email: g.email || "",
        location: g.address || "",
        subtotal: Number(g.subtotal) || 0,
        vatRate: Number(g.vatRate) || 0,
        vatAmount: Number(g.vat) || 0,
        totalAmount: Number(g.total) || 0,
        currency: g.currency || "AED",
        trn: g.trn || "",
        lineItems,
        description: lineItems
            .map((i) => i.description)
            .filter(Boolean)
            .join("; "),
    };

    return {
        invoice,
        validation: validationService.validate(invoice),
    };
}

// Gemini reports startPage as a 1-indexed page number WITHIN THE CHUNK FILE
// it was given (see getInvoiceSchema/getPrompt in geminiService.js) — not
// the invoice's position in the "invoices" array. Using the reported page
// directly (instead of the array index) keeps every invoice's source-file
// attachment correct even when one invoice spans multiple pages, which
// used to shift every invoice after it by one page (a 2-page invoice was
// being split into two invoice entries, so array position no longer
// matched page number).
function resolveRelativeStartPage(g, localIdx) {
    const startPage = Number(g.startPage);

    if (Number.isInteger(startPage) && startPage >= 1) {
        return startPage;
    }

    // Gemini omitted/mis-typed startPage (or this is a mocked/legacy
    // response) — fall back to the previous array-position behavior.
    return localIdx + 1;
}

// Backend safety net on top of the prompt/schema guidance in
// geminiService.js: even with explicit multi-page instructions, Gemini
// sometimes still emits a bogus extra "invoice" for a continuation page
// (totals/tax summary/bank details/signatures) of a real, harder-to-read
// scanned document — recognizable because it has NO invoice number of its
// own. A genuine invoice practically always carries some reference
// number, so an entry without one is treated as a continuation of the
// PREVIOUS invoice in this same file rather than a standalone document —
// unless it clearly claims its own identity (its own line items AND its
// own, different vendor name), in which case it's left alone.
function looksLikeContinuationFragment(previous, fragment) {
    if (String(fragment.invoiceNumber || "").trim()) {
        return false;
    }

    const hasOwnLineItems =
        Array.isArray(fragment.lineItems) && fragment.lineItems.length > 0;

    if (!hasOwnLineItems) {
        return true;
    }

    const fragmentVendor = String(fragment.vendorName || "").trim();

    if (!fragmentVendor) {
        return true;
    }

    return partyNameService.namesLikelyMatch(
        previous.vendorName,
        fragmentVendor
    );
}

// Merges a continuation fragment into the invoice it belongs to — fills
// only fields the primary invoice left blank/zero (never overwrites data
// it already captured), and appends any line items the fragment has.
function mergeContinuationFragment(previous, fragment) {
    const merged = { ...previous };

    merged.lineItems = [
        ...(previous.lineItems || []),
        ...(fragment.lineItems || []),
    ];

    const fillIfBlank = [
        "vendorName", "buyerName", "invoiceDate", "dueDate", "trn",
        "phone", "email", "address", "currency",
    ];

    for (const field of fillIfBlank) {
        if (!String(merged[field] || "").trim() && fragment[field]) {
            merged[field] = fragment[field];
        }
    }

    const fillIfZero = ["subtotal", "vatRate", "vat", "total"];

    for (const field of fillIfZero) {
        if (!Number(merged[field]) && Number(fragment[field])) {
            merged[field] = fragment[field];
        }
    }

    if (Number(fragment.endPage) > Number(merged.endPage || 0)) {
        merged.endPage = fragment.endPage;
    }

    return merged;
}

// Collapses continuation fragments produced within a single Gemini
// response into the invoice they belong to, in page order.
function collapseContinuationFragments(rawInvoices) {
    const collapsed = [];

    for (const g of rawInvoices) {
        if (!g) continue;

        const previous = collapsed[collapsed.length - 1];

        if (previous && looksLikeContinuationFragment(previous, g)) {
            collapsed[collapsed.length - 1] = mergeContinuationFragment(previous, g);
        } else {
            collapsed.push(g);
        }
    }

    return collapsed;
}

function appendInvoicesFromGemini(result, invoices, chunk = {}) {

    const rawInvoices = Array.isArray(result.invoice)
        ? result.invoice
        : [result.invoice];

    const collapsedInvoices = collapseContinuationFragments(
        rawInvoices.filter(Boolean)
    );

    // 1-indexed absolute page (in the original PDF) where this chunk's
    // first page lands. Chunks built from a single-request PDF (no
    // splitting) don't set pageStart, so the chunk IS the whole file.
    const chunkPageStart = chunk.pageStart ?? 1;

    collapsedInvoices.forEach((g, localIdx) => {
        const mapped = mapGeminiInvoice(g);
        const relativeStartPage = resolveRelativeStartPage(g, localIdx);

        mapped.pageIndex = chunkPageStart - 1 + (relativeStartPage - 1);
        invoices.push(mapped);
    });
}

class InvoiceService {

    async extract(imagePath) {
        const result = await GeminiService.extractInvoice(imagePath);

        if (!result.success) {
            return result;
        }

        const mapped = mapGeminiInvoice(result.invoice);

        return {
            success: true,
            invoice: mapped.invoice,
            validation: mapped.validation,
        };
    }

    // async extractPDF(pdfPath) {

    //     const pageCount = await pdfService.getPageCount(pdfPath);
    //     const chunkPages = Math.max(1, DEFAULT_CHUNK_PAGES);

    //     let chunkFiles = [{ file: pdfPath }];
    //     let tempDir = null;

    //     if (pageCount > chunkPages) {
    //         const built = await pdfService.buildChunks(pdfPath, chunkPages);
    //         chunkFiles = built.chunks;
    //         tempDir = built.tempDir;

    //         console.log(
    //             `[PDF] ${pageCount} pages → ${chunkFiles.length} Gemini requests ` +
    //             `(max ${chunkPages} pages/request, rate-limited)`
    //         );
    //     }

    //     const invoices = [];
    //     const errors = [];

    //     try {

    //         for (let i = 0; i < chunkFiles.length; i++) {

    //             const chunk = chunkFiles[i];
    //             const label = chunk.pageStart
    //                 ? `pages ${chunk.pageStart}-${chunk.pageEnd}`
    //                 : `full file`;

    //             console.log(
    //                 `[PDF] Gemini chunk ${i + 1}/${chunkFiles.length} (${label})`
    //             );

    //             const result = await GeminiService.extractInvoice(chunk.file);

    //             if (!result.success) {
    //                 errors.push(result.error);
    //                 continue;
    //             }

    //             appendInvoicesFromGemini(result, invoices, chunk);
    //         }

    //     } finally {

    //         if (tempDir) {
    //             pdfService.cleanupDir(tempDir);
    //         }

    //     }

    //     if (invoices.length === 0) {
    //         return {
    //             success: false,
    //             error:
    //                 errors[0] ||
    //                 "No invoices could be extracted from this PDF.",
    //         };
    //     }

    //     return {
    //         success: true,
    //         invoices,
    //         meta: {
    //             pageCount,
    //             geminiRequests: chunkFiles.length,
    //         },
    //     };
    // }


    async extractPDF(pdfPath) {

        const pageCount = await pdfService.getPageCount(pdfPath);
        const chunkPages = Math.max(1, DEFAULT_CHUNK_PAGES);
    
        let chunkFiles = [{ file: pdfPath }];
        let tempDir = null;
    
        if (pageCount > chunkPages) {
            const built = await pdfService.buildChunks(
                pdfPath,
                chunkPages
            );
    
            chunkFiles = built.chunks;
            tempDir = built.tempDir;
    
            console.log(
                `[PDF] ${pageCount} pages → ${chunkFiles.length} Gemini requests ` +
                `(max ${chunkPages} pages/request, rate-limited)`
            );
        }
    
        const invoices = [];
        const errors = [];
    
        try {
    
            for (let i = 0; i < chunkFiles.length; i++) {
    
                const chunk = chunkFiles[i];
    
                const label = chunk.pageStart
                    ? `pages ${chunk.pageStart}-${chunk.pageEnd}`
                    : "full file";
    
                console.log(
                    `[PDF] Gemini chunk ${i + 1}/${chunkFiles.length} (${label})`
                );
    
                try {
    
                    const result = await GeminiService.extractInvoice(
                        chunk.file
                    );
    
                    if (!result.success) {
    
                        errors.push({
                            chunk: i + 1,
                            pageStart: chunk.pageStart ?? null,
                            pageEnd: chunk.pageEnd ?? null,
                            error:
                                result.error ||
                                "Gemini extraction failed."
                        });
    
                        continue;
                    }
    
                    appendInvoicesFromGemini(
                        result,
                        invoices,
                        chunk
                    );
    
                } catch (err) {
    
                    errors.push({
                        chunk: i + 1,
                        pageStart: chunk.pageStart ?? null,
                        pageEnd: chunk.pageEnd ?? null,
                        error:
                            err.message ||
                            "Unexpected Gemini extraction error."
                    });
    
                    console.error(
                        `[PDF] Chunk ${i + 1} failed:`,
                        err.message
                    );
                }
            }
    
        } finally {
    
            if (tempDir) {
                pdfService.cleanupDir(tempDir);
            }
    
        }
    
        // Completely failed PDF
        if (invoices.length === 0) {
    
            return {
                success: false,
    
                error:
                    errors[0]?.error ||
                    "No invoices could be extracted from this PDF.",
    
                errors,
    
                meta: {
                    pageCount,
                    geminiRequests: chunkFiles.length,
                    successfulChunks: 0,
                    failedChunks: errors.length,
                    partialFailure: false
                }
            };
        }
    
        // Successful or partially successful PDF
        return {
            success: true,
    
            invoices,
    
            // IMPORTANT:
            // Do not discard failed chunks.
            errors,
    
            meta: {
                pageCount,
                geminiRequests: chunkFiles.length,
    
                successfulChunks:
                    chunkFiles.length - errors.length,
    
                failedChunks:
                    errors.length,
    
                partialFailure:
                    errors.length > 0
            }
        };
    }
}

module.exports = new InvoiceService();
