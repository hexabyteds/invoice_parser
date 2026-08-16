const invoiceService = require("./services/invoiceService");
const excelService = require("./services/excelService");
const reportService = require("./services/reportService");
const exportFormatsService = require("./services/exportFormatsService");
const invoiceNormalizer = require("./services/invoiceNormalizer");
const usageService = require("./services/usageService");
const pdfService = require("./services/pdfService");

const invoiceRepository = require("./repositories/invoiceRepository");
const invoiceItemRepository = require("./repositories/invoiceItemRepository");
const { formatDate } = require("./utils/dateUtils");
const {
    toStoredSourcePath,
    resolveUploadPath,
    deleteStoredFileAndGetSize
} = require("./utils/uploadPaths");

class FreeInvoiceAgent {

    // =========================
    // SOURCE HELPERS
    // =========================

    persistSourceOnInvoice(invoice, absoluteOrRelativePath) {
        const stored = toStoredSourcePath(absoluteOrRelativePath);

        invoice.imagePath = stored;
        invoice.image_path = stored;

        return stored;
    }

    async saveSourceForInvoices(
        sourceFilePath,
        pdfPath,
        extractedItems
    ) {
        const count = extractedItems.length;

        if (count <= 1) {
            return extractedItems.map(() => sourceFilePath);
        }

        const pageFiles = await pdfService.split(pdfPath);

        return extractedItems.map((item, i) => {
            const pageIndex = item.pageIndex ?? i;

            return (
                pdfService.pageFileAt(pageFiles, pageIndex) ||
                sourceFilePath
            );
        });
    }

    // =========================
    // IMAGE
    // =========================

    async processImage(
        imagePath,
        userId,
        clientId,
        sourceFilePath = imagePath,
        documentType = null
    ) {
        // Reserve OCR quota atomically before Gemini.
        await usageService.reserveOCRPages(userId, 1);

        // Reserve invoice quota atomically.
        try {
            await usageService.reserveInvoiceSlot(userId);
        } catch (err) {
            // Invoice reservation failed, so release OCR reservation.
            await usageService.decrementOCR(userId, 1);
            throw err;
        }

        const result = await invoiceService.extract(imagePath);

        // ==========================================
        // Extraction failed
        // ==========================================

        if (!result.success) {
            await usageService.decrementOCR(userId, 1);
            await usageService.decrementInvoices(userId);

            return {
                status: "error",
                message:
                    result.error ||
                    "Invoice extraction failed."
            };
        }

        // ==========================================
        // GEM-01: Validation gate
        // ==========================================
        //
        // Gemini successfully extracted something,
        // but that does NOT mean it is a valid invoice.
        //
        // Do not persist invalid/non-invoice documents.
        // Do not consume invoice quota for them.
        //
        // OCR quota remains consumed because Gemini
        // processing actually happened.

        if (!result.validation?.isValid) {
            await usageService.decrementInvoices(userId);

            return {
                status: "error",
                message:
                    result.validation?.errors?.join(", ") ||
                    "The uploaded document is not a valid invoice.",
                validation: result.validation || {
                    isValid: false,
                    errors: [
                        "The uploaded document is not a valid invoice."
                    ]
                }
            };
        }

        // ==========================================
        // Normalize valid invoice
        // ==========================================

        result.invoice = invoiceNormalizer.normalize(
            result.invoice
        );

        result.invoice.user_id = userId;
        result.invoice.client_id = clientId;
        result.invoice.document_type = documentType;

        const stored = this.persistSourceOnInvoice(
            result.invoice,
            sourceFilePath
        );

        // ==========================================
        // Persist invoice
        // ==========================================

        try {
            const invoiceId =
                await invoiceRepository.create(
                    result.invoice
                );

            await invoiceRepository.updateImagePath(
                invoiceId,
                userId,
                stored
            );

            await invoiceItemRepository.createMany(
                invoiceId,
                result.invoice.lineItems
            );

            result.invoice.id = invoiceId;

        } catch (err) {
            // Extraction was valid, but persistence failed.
            // Release invoice quota.
            //
            // OCR remains consumed because Gemini
            // successfully processed the document.

            await usageService.decrementInvoices(userId);

            throw err;
        }

        return {
            status: "success",
            invoice: result.invoice,
            validation: result.validation
        };
    }

    // =========================
    // PDF
    // =========================

    async processPDF(
        pdfPath,
        userId,
        clientId,
        sourceFilePath = pdfPath,
        documentType = null
    ) {
        const pageCount = await pdfService.getPageCount(pdfPath);
    
        // Reserve the maximum possible OCR usage before Gemini processing.
        // Failed pages will be refunded after extraction.
        await usageService.reserveOCRPages(userId, pageCount);
    
        let result;
    
        try {
            result = await invoiceService.extractPDF(pdfPath);
        } catch (err) {
            // Gemini/extraction failed completely.
            // Nothing was successfully processed, so release all reserved pages.
            await usageService.decrementOCR(userId, pageCount);
    
            throw err;
        }
    
        // ============================================
        // Completely failed PDF
        // ============================================
    
        if (!result.success) {
            await usageService.decrementOCR(userId, pageCount);
    
            return {
                status: "error",
                message: result.error,
                errors: result.errors || [],
                meta: result.meta || {
                    pageCount
                }
            };
        }
    
        // ============================================
        // Calculate failed pages
        // ============================================
    
        let failedPages = 0;
    
        if (Array.isArray(result.errors)) {
    
            for (const error of result.errors) {
    
                // Chunk with known page range
                if (
                    Number.isInteger(error.pageStart) &&
                    Number.isInteger(error.pageEnd) &&
                    error.pageEnd >= error.pageStart
                ) {
                    failedPages +=
                        error.pageEnd - error.pageStart + 1;
                } else {
                    // Fallback for a single unknown page
                    failedPages += 1;
                }
            }
        }
    
        // Never refund more than we actually reserved.
        failedPages = Math.min(
            failedPages,
            pageCount
        );
    
        // ============================================
        // Refund failed pages
        // ============================================
    
        if (failedPages > 0) {
    
            await usageService.decrementOCR(
                userId,
                failedPages
            );
        }
    
        // ============================================
        // Save successfully extracted invoices
        // ============================================
    
        const sourcePaths = await this.saveSourceForInvoices(
            sourceFilePath,
            pdfPath,
            result.invoices
        );
    
        const savedInvoices = [];
    
        for (
            let i = 0;
            i < result.invoices.length;
            i++
        ) {
    
            const item = result.invoices[i];
    
            // Reserve invoice quota atomically.
            await usageService.reserveInvoiceSlot(userId);
    
            const invoice =
                invoiceNormalizer.normalize(item.invoice);
    
            invoice.user_id = userId;
            invoice.client_id = clientId;
            invoice.document_type = documentType;

            const stored =
                this.persistSourceOnInvoice(
                    invoice,
                    sourcePaths[i]
                );
    
            try {
    
                const invoiceId =
                    await invoiceRepository.create(
                        invoice
                    );
    
                await invoiceRepository.updateImagePath(
                    invoiceId,
                    userId,
                    stored
                );
    
                await invoiceItemRepository.createMany(
                    invoiceId,
                    invoice.lineItems
                );
    
                invoice.id = invoiceId;
    
                savedInvoices.push(invoice);
    
            } catch (err) {
    
                // Invoice reservation was successful,
                // but persistence failed.
                await usageService.decrementInvoices(
                    userId,
                    1
                );
    
                throw err;
            }
        }
    
        return {
            status: "success",
    
            invoices: savedInvoices,
    
            totalInvoices: savedInvoices.length,
    
            // Useful for frontend/UI and debugging
            errors: result.errors || [],
    
            meta: {
                ...(result.meta || {}),
    
                pageCount,
    
                failedPages,
    
                successfulPages:
                    pageCount - failedPages,
    
                partialFailure:
                    failedPages > 0
            }
        };
    }

    // =========================
    // GET ALL INVOICES
    // =========================

    async getInvoices(
        userId,
        { limit = 20, offset = 0, documentType = null, from = null, to = null } = {}
    ) {
        const [invoices, total] =
            await Promise.all([
                invoiceRepository.findByUser(
                    userId,
                    {
                        limit,
                        offset,
                        documentType,
                        from,
                        to
                    }
                ),

                invoiceRepository.countByUser(
                    userId,
                    { documentType, from, to }
                )
            ]);

        return {
            invoices,
            total
        };
    }

    // =========================
    // SINGLE INVOICE
    // =========================

    async getInvoiceById(
        invoiceId,
        userId
    ) {
        const invoice =
            await invoiceRepository.findById(
                invoiceId,
                userId
            );

        if (!invoice) {
            return null;
        }

        const lineItems =
            await invoiceItemRepository.findByInvoice(
                invoice.id
            );

        return {
            invoice,
            lineItems
        };
    }

    // =========================
    // INVOICE SOURCE
    // =========================

    async getInvoiceSourcePath(
        invoiceId,
        userId
    ) {
        const invoice =
            await invoiceRepository.findById(
                invoiceId,
                userId
            );

        if (!invoice?.image_path) {
            return null;
        }

        const fs = require("fs");

        const absolutePath =
            resolveUploadPath(
                invoice.image_path
            );

        if (
            !absolutePath ||
            !fs.existsSync(absolutePath)
        ) {
            return null;
        }

        return {
            absolutePath,
            storedPath: invoice.image_path
        };
    }

    // =========================
    // DELETE INVOICE
    // =========================

    async deleteInvoice(
        invoiceId,
        userId
    ) {
        const existing =
            await invoiceRepository.findById(
                invoiceId,
                userId
            );

        if (!existing) {
            return false;
        }

        await invoiceItemRepository.delete(
            invoiceId
        );

        const removed =
            await invoiceRepository.deleteById(
                invoiceId,
                userId
            );

        // Storage quota was never released when an invoice was deleted —
        // reclaim it (and the on-disk file) now, based on the file's real
        // current size rather than a recorded one (see deleteStoredFileAndGetSize).
        if (removed > 0 && existing.image_path) {
            const freedBytes =
                await deleteStoredFileAndGetSize(existing.image_path);

            if (freedBytes > 0) {
                await usageService.removeStorage(userId, freedBytes);
            }
        }

        return removed > 0;
    }

    // =========================
    // UPDATE INVOICE
    // =========================

    async updateInvoice(
        invoiceId,
        userId,
        data
    ) {
        const existing =
            await invoiceRepository.findById(
                invoiceId,
                userId
            );

        if (!existing) {
            return null;
        }

        const numericFields = ["subtotal", "vat_rate", "vat_amount", "total_amount"];

        for (const field of numericFields) {
            if (data[field] === undefined || data[field] === null) continue;

            const value = Number(data[field]);

            if (Number.isNaN(value) || value < 0) {
                throw new Error(
                    `Invalid value for ${field}: must be a non-negative number.`
                );
            }
        }

        const dateFields = ["invoice_date", "due_date"];

        for (const field of dateFields) {
            if (!data[field]) continue;

            if (!formatDate(data[field])) {
                throw new Error(
                    `Invalid value for ${field}: must be a valid date.`
                );
            }
        }

        // Validate line items up front, before anything is written to the
        // DB — the old code found this out mid-write (via a raw MySQL
        // error) after already deleting the invoice's existing line items.
        let items;

        if (Array.isArray(data.lineItems)) {

            items = data.lineItems.map(item => ({
                description: item.description || "",
                quantity: item.quantity ?? 0,
                unitPrice: item.unit_price ?? item.unitPrice ?? 0,
                totalPrice: item.total_price ?? item.totalPrice ?? 0
            }));

            const lineItemNumericFields = ["quantity", "unitPrice", "totalPrice"];

            items.forEach((item, index) => {
                for (const field of lineItemNumericFields) {
                    const value = Number(item[field]);

                    if (Number.isNaN(value) || value < 0) {
                        throw new Error(
                            `Invalid value for line item ${index + 1} ${field}: must be a non-negative number.`
                        );
                    }
                }
            });

        }

        const merged = {
            invoice_no: data.invoice_no ?? existing.invoice_no,
            client_name: data.client_name ?? existing.client_name,
            invoice_date: data.invoice_date ?? existing.invoice_date,
            due_date: data.due_date ?? existing.due_date,
            phone_number: data.phone_number ?? existing.phone_number,
            location: data.location ?? existing.location,
            description: data.description ?? existing.description,
            subtotal: data.subtotal ?? existing.subtotal,
            vat_rate: data.vat_rate ?? existing.vat_rate,
            vat_amount: data.vat_amount ?? existing.vat_amount,
            total_amount: data.total_amount ?? existing.total_amount,
            currency: data.currency ?? existing.currency,
            trn: data.trn ?? existing.trn,
            document_type: data.document_type ?? existing.document_type,
        };

        await invoiceRepository.update(
            invoiceId,
            userId,
            merged
        );

        // Replace line items if provided — delete+recreate happens
        // atomically, so a failure here can't leave the invoice with fewer
        // line items than it started with (see replaceForInvoice).
        if (items) {
            await invoiceItemRepository.replaceForInvoice(
                invoiceId,
                items
            );
        }

        return await this.getInvoiceById(
            invoiceId,
            userId
        );
    }

    // =========================
    // STATISTICS
    // =========================

    async getStats(
        userId,
        clientId = null
    ) {
        if (clientId) {
            return await invoiceRepository
                .getStatisticsByClient(
                    userId,
                    clientId
                );
        }

        return await invoiceRepository
            .getStatistics(userId);
    }

    // =========================
    // EXPORT HELPERS
    // =========================

    async getExportInvoices(
        userId,
        filters = {}
    ) {
        return await invoiceRepository
            .findForExport(userId, {
                clientId:
                    filters.clientId || null,

                from:
                    filters.from || null,

                to:
                    filters.to || null,

                documentType:
                    filters.documentType || null
            });
    }

    // =========================
    // EXCEL
    // =========================

    async saveToExcel(
        userId,
        clientId = null,
        file = `invoices_${new Date()
            .toISOString()
            .split("T")[0]}.xlsx`,
        filters = {}
    ) {
        const invoices =
            await this.getExportInvoices(
                userId,
                {
                    clientId,
                    ...filters
                }
            );

        return await excelService.export(
            invoices,
            file
        );
    }

    // =========================
    // CSV
    // =========================

    async exportCSV(
        userId,
        filters = {}
    ) {
        const invoices =
            await this.getExportInvoices(
                userId,
                filters
            );

        return {
            csv:
                exportFormatsService
                    .toStandardCsv(invoices),

            count: invoices.length
        };
    }

    // =========================
    // ZOHO
    // =========================

    async exportZoho(
        userId,
        filters = {},
        file = `zoho_bills_${Date.now()}.xlsx`
    ) {
        const invoices =
            await this.getExportInvoices(
                userId,
                filters
            );

        const filePath =
            await exportFormatsService
                .toZohoBillsExcel(
                    invoices,
                    file
                );

        return {
            filePath,
            count: invoices.length
        };
    }

    // =========================
    // QUICKBOOKS
    // =========================

    async exportQuickBooks(
        userId,
        filters = {}
    ) {
        const invoices =
            await this.getExportInvoices(
                userId,
                filters
            );

        return {
            csv:
                exportFormatsService
                    .toQuickBooksCsv(invoices),

            count: invoices.length
        };
    }

    // =========================
    // PDF EXPORT
    // =========================

    async exportPDF(
        userId,
        filters = {},
        file = `invoices_export_${Date.now()}.pdf`
    ) {
        const invoices =
            await this.getExportInvoices(
                userId,
                filters
            );

        const filePath =
            await exportFormatsService.toPdf(
                invoices,
                file
            );

        return {
            filePath,
            count: invoices.length
        };
    }

    // =========================
    // HTML REPORT
    // =========================

    async generateHTMLReport(
        userId,
        clientId = null,
        file = "invoice_report.html",
        filters = {}
    ) {
        const invoices =
            await this.getExportInvoices(
                userId,
                {
                    clientId,
                    ...filters
                }
            );

        return await reportService.generate(
            invoices,
            file
        );
    }

    // =========================
    // CLEAR
    // =========================

    async clear(
        userId,
        clientId = null
    ) {
        if (clientId) {
            return await invoiceRepository
                .deleteByClient(
                    userId,
                    clientId
                );
        }

        // Read the file paths before the bulk delete removes the rows
        // that reference them, then reclaim storage/disk for all of them
        // in one pass — same fix as deleteInvoice, applied to bulk clear.
        const imagePaths =
            await invoiceRepository.findImagePathsByUser(userId);

        const removed =
            await invoiceRepository.deleteAll(userId);

        let freedBytes = 0;

        for (const imagePath of imagePaths) {
            freedBytes += await deleteStoredFileAndGetSize(imagePath);
        }

        if (freedBytes > 0) {
            await usageService.removeStorage(userId, freedBytes);
        }

        return removed;
    }

    // =========================
    // ANALYTICS
    // =========================

    async getAnalytics(
        userId,
        clientId = null
    ) {
        return await invoiceRepository
            .getAnalytics(
                userId,
                clientId
            );
    }

    // =========================
    // INVOICES BY CLIENT
    // =========================

    async getInvoicesByClient(
        userId,
        clientId,
        { limit = 20, offset = 0, documentType = null, from = null, to = null } = {}
    ) {
        const [invoices, total] =
            await Promise.all([
                invoiceRepository.findByClient(
                    userId,
                    clientId,
                    {
                        limit,
                        offset,
                        documentType,
                        from,
                        to
                    }
                ),

                invoiceRepository.countByClient(
                    userId,
                    clientId,
                    { documentType, from, to }
                )
            ]);

        return {
            invoices,
            total
        };
    }
}

module.exports = FreeInvoiceAgent;