const invoiceService = require("./services/invoiceService");
const excelService = require("./services/excelService");
const reportService = require("./services/reportService");
const exportFormatsService = require("./services/exportFormatsService");
const invoiceNormalizer = require("./services/invoiceNormalizer");
const usageService = require("./services/usageService");
const pdfService = require("./services/pdfService");

const invoiceRepository = require("./repositories/invoiceRepository");
const invoiceItemRepository = require("./repositories/invoiceItemRepository");
const { toStoredSourcePath, resolveUploadPath } = require("./utils/uploadPaths");

class FreeInvoiceAgent {

    persistSourceOnInvoice(invoice, absoluteOrRelativePath) {
        const stored = toStoredSourcePath(absoluteOrRelativePath);
        invoice.imagePath = stored;
        invoice.image_path = stored;
        return stored;
    }

    async saveSourceForInvoices(sourceFilePath, pdfPath, extractedItems) {
        const count = extractedItems.length;

        if (count <= 1) {
            return extractedItems.map(() => sourceFilePath);
        }

        const pageFiles = await pdfService.split(pdfPath);

        return extractedItems.map((item, i) => {
            const pageIndex = item.pageIndex ?? i;
            return pdfService.pageFileAt(pageFiles, pageIndex) || sourceFilePath;
        });
    }

    // =========================
    // IMAGE
    // =========================

    async processImage(imagePath, userId, clientId, sourceFilePath = imagePath) {

        // Both quotas are reserved (atomically checked-and-incremented) up
        // front, before the slow Gemini call, then released again on any
        // failure below — this preserves the original behaviour (nothing is
        // charged for a failed extraction) while closing the race where two
        // concurrent uploads could both pass a check before either had
        // incremented. See usageService.reserveOCRPages for the full
        // explanation of why this is safe under concurrency.
        await usageService.reserveOCRPages(userId, 1);

        try {
            await usageService.reserveInvoiceSlot(userId);
        } catch (err) {
            await usageService.decrementOCR(userId, 1);
            throw err;
        }

        const result = await invoiceService.extract(imagePath);

        if (!result.success) {
            await usageService.decrementOCR(userId, 1);
            await usageService.decrementInvoices(userId);
            return {
                status: "error",
                message: result.error,
            };
        }

        result.invoice = invoiceNormalizer.normalize(result.invoice);

        result.invoice.user_id = userId;
        result.invoice.client_id = clientId;

        const stored = this.persistSourceOnInvoice(result.invoice, sourceFilePath);

        try {
            const invoiceId = await invoiceRepository.create(result.invoice);
            await invoiceRepository.updateImagePath(invoiceId, userId, stored);

            await invoiceItemRepository.createMany(
                invoiceId,
                result.invoice.lineItems
            );

            result.invoice.id = invoiceId;
        } catch (err) {
            // Extraction succeeded (the OCR page was genuinely spent calling
            // Gemini) but persisting it failed — release only the invoice
            // reservation, matching the original ordering where the OCR
            // increment happened unconditionally on extraction success and
            // the invoice increment happened only after a successful save.
            await usageService.decrementInvoices(userId);
            throw err;
        }

        return {
            status: "success",
            invoice: result.invoice,
            validation: result.validation,
        };
    }

    // =========================
    // PDF
    // =========================

    async processPDF(pdfPath, userId, clientId, sourceFilePath = pdfPath) {

        const pageCount = await pdfService.getPageCount(pdfPath);

        // Reserve the whole page count atomically before the slow Gemini
        // call (same reasoning as processImage above); released again if
        // extraction fails, so a failed PDF still costs nothing.
        await usageService.reserveOCRPages(userId, pageCount);

        const result = await invoiceService.extractPDF(pdfPath);

        if (!result.success) {
            await usageService.decrementOCR(userId, pageCount);
            return {
                status: "error",
                message: result.error,
            };
        }

        const sourcePaths = await this.saveSourceForInvoices(
            sourceFilePath,
            pdfPath,
            result.invoices
        );

        const savedInvoices = [];

        for (let i = 0; i < result.invoices.length; i++) {
            const item = result.invoices[i];

            // Atomically reserves this one invoice slot; throws (same error
            // and same "stop processing further pages" behaviour as before)
            // if the plan is already full by this iteration.
            await usageService.reserveInvoiceSlot(userId);

            const invoice = invoiceNormalizer.normalize(item.invoice);

            invoice.user_id = userId;
            invoice.client_id = clientId;

            const stored = this.persistSourceOnInvoice(
                invoice,
                sourcePaths[i]
            );

            try {
                const invoiceId = await invoiceRepository.create(invoice);
                await invoiceRepository.updateImagePath(invoiceId, userId, stored);

                await invoiceItemRepository.createMany(
                    invoiceId,
                    invoice.lineItems
                );

                invoice.id = invoiceId;
                savedInvoices.push(invoice);
            } catch (err) {
                // Only this iteration's reservation is released — invoices
                // already saved earlier in the loop keep their increments,
                // matching the original per-iteration increment behaviour.
                await usageService.decrementInvoices(userId);
                throw err;
            }
        }

        return {
            status: "success",
            invoices: savedInvoices,
            totalInvoices: savedInvoices.length,
        };
    }

    // =========================
    // GET ALL INVOICES
    // =========================

    async getInvoices(userId, { limit = 20, offset = 0 } = {}) {
        const [invoices, total] = await Promise.all([
            invoiceRepository.findByUser(userId, { limit, offset }),
            invoiceRepository.countByUser(userId),
        ]);

        return { invoices, total };
    }

    // =========================
    // SINGLE INVOICE
    // =========================

    async getInvoiceById(invoiceId, userId) {

        const invoice = await invoiceRepository.findById(
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
            lineItems,
        };
    }

    async getInvoiceSourcePath(invoiceId, userId) {
        const invoice = await invoiceRepository.findById(invoiceId, userId);
        if (!invoice?.image_path) {
            return null;
        }

        const fs = require("fs");
        const absolutePath = resolveUploadPath(invoice.image_path);

        if (!absolutePath || !fs.existsSync(absolutePath)) {
            return null;
        }

        return { absolutePath, storedPath: invoice.image_path };
    }

    async deleteInvoice(invoiceId, userId) {
        const existing = await invoiceRepository.findById(
            invoiceId,
            userId
        );

        if (!existing) {
            return false;
        }

        await invoiceItemRepository.delete(invoiceId);
        const removed = await invoiceRepository.deleteById(
            invoiceId,
            userId
        );

        return removed > 0;
    }

    // =========================
    // UPDATE INVOICE
    // =========================

    async updateInvoice(invoiceId, userId, data) {

        const existing = await invoiceRepository.findById(
            invoiceId,
            userId
        );

        if (!existing) {
            return null;
        }

        await invoiceRepository.update(invoiceId, userId, data);

        // Replace line items if provided
        if (Array.isArray(data.lineItems)) {

            await invoiceItemRepository.delete(invoiceId);

            const items = data.lineItems.map(item => ({
                description: item.description || "",
                quantity: item.quantity ?? 0,
                unitPrice: item.unit_price ?? item.unitPrice ?? 0,
                totalPrice: item.total_price ?? item.totalPrice ?? 0
            }));

            await invoiceItemRepository.createMany(invoiceId, items);
        }

        return await this.getInvoiceById(invoiceId, userId);
    }

    // =========================
    // STATISTICS
    // =========================

    async getStats(userId, clientId = null) {

        if (clientId) {
            return await invoiceRepository.getStatisticsByClient(
                userId,
                clientId
            );
        }

        return await invoiceRepository.getStatistics(userId);
    }

    // =========================
    // EXPORT HELPERS
    // =========================

    async getExportInvoices(userId, filters = {}) {
        return await invoiceRepository.findForExport(userId, {
            clientId: filters.clientId || null,
            from: filters.from || null,
            to: filters.to || null,
        });
    }

    // =========================
    // EXCEL
    // =========================

    async saveToExcel(
        userId,
        clientId = null,
        file = `invoices_${new Date().toISOString().split("T")[0]}.xlsx`,
        filters = {}
    ) {
        const invoices = await this.getExportInvoices(userId, {
            clientId,
            ...filters,
        });

        console.log("Excel export:", {
            userId,
            clientId: clientId || "ALL",
            from: filters.from || null,
            to: filters.to || null,
            count: invoices.length,
        });

        return await excelService.export(invoices, file);
    }

    // =========================
    // CSV / ZOHO / QUICKBOOKS / PDF
    // =========================

    async exportCSV(userId, filters = {}) {
        const invoices = await this.getExportInvoices(userId, filters);
        return {
            csv: exportFormatsService.toStandardCsv(invoices),
            count: invoices.length,
        };
    }

    async exportZoho(
        userId,
        filters = {},
        file = `zoho_bills_${Date.now()}.xlsx`
    ) {
        const invoices = await this.getExportInvoices(userId, filters);
        const filePath = await exportFormatsService.toZohoBillsExcel(
            invoices,
            file
        );
        return {
            filePath,
            count: invoices.length,
        };
    }

    async exportQuickBooks(userId, filters = {}) {
        const invoices = await this.getExportInvoices(userId, filters);
        return {
            csv: exportFormatsService.toQuickBooksCsv(invoices),
            count: invoices.length,
        };
    }

    async exportPDF(
        userId,
        filters = {},
        file = `invoices_export_${Date.now()}.pdf`
    ) {
        const invoices = await this.getExportInvoices(userId, filters);
        const filePath = await exportFormatsService.toPdf(invoices, file);
        return {
            filePath,
            count: invoices.length,
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

        const invoices = await this.getExportInvoices(userId, {
            clientId,
            ...filters,
        });

        return await reportService.generate(invoices, file);
    }

    // =========================
    // CLEAR
    // =========================

    async clear(userId, clientId = null) {

        if (clientId) {
            return await invoiceRepository.deleteByClient(
                userId,
                clientId
            );
        }

        return await invoiceRepository.deleteAll(userId);
    }

    // =========================
    // ANALYTICS
    // =========================

    async getAnalytics(userId, clientId = null) {
        return await invoiceRepository.getAnalytics(userId, clientId);
    }
    async getInvoicesByClient(userId, clientId, { limit = 20, offset = 0 } = {}) {
        const [invoices, total] = await Promise.all([
            invoiceRepository.findByClient(userId, clientId, { limit, offset }),
            invoiceRepository.countByClient(userId, clientId),
        ]);

        return { invoices, total };
     }
}

module.exports = FreeInvoiceAgent;