const GeminiService = require("./geminiService");
const validationService = require("./validationService");
const pdfService = require("./pdfService");

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
        clientName: g.vendorName || "",
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

function appendInvoicesFromGemini(result, invoices, chunk = {}) {

    const rawInvoices = Array.isArray(result.invoice)
        ? result.invoice
        : [result.invoice];

    const pageStart = chunk.pageStart;

    rawInvoices.filter(Boolean).forEach((g, localIdx) => {
        const mapped = mapGeminiInvoice(g);
        mapped.pageIndex =
            pageStart != null ? pageStart - 1 + localIdx : localIdx;
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
