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

        await usageService.checkOCRLimit(userId, 1);
        await usageService.checkInvoiceLimit(userId);

        const result = await invoiceService.extract(imagePath);

        if (!result.success) {
            return {
                status: "error",
                message: result.error,
            };
        }

        await usageService.incrementOCR(userId, 1);

        result.invoice = invoiceNormalizer.normalize(result.invoice);

        result.invoice.user_id = userId;
        result.invoice.client_id = clientId;

        const stored = this.persistSourceOnInvoice(result.invoice, sourceFilePath);

        const invoiceId = await invoiceRepository.create(result.invoice);
        await invoiceRepository.updateImagePath(invoiceId, userId, stored);

        await invoiceItemRepository.createMany(
            invoiceId,
            result.invoice.lineItems
        );

        await usageService.incrementInvoices(userId);

        result.invoice.id = invoiceId;

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

        await usageService.checkOCRLimit(userId, pageCount);

        const result = await invoiceService.extractPDF(pdfPath);

        if (!result.success) {
            return {
                status: "error",
                message: result.error,
            };
        }

        await usageService.incrementOCR(userId, pageCount);

        const sourcePaths = await this.saveSourceForInvoices(
            sourceFilePath,
            pdfPath,
            result.invoices
        );

        const savedInvoices = [];

        for (let i = 0; i < result.invoices.length; i++) {
            const item = result.invoices[i];

            await usageService.checkInvoiceLimit(userId);

            const invoice = invoiceNormalizer.normalize(item.invoice);

            invoice.user_id = userId;
            invoice.client_id = clientId;

            const stored = this.persistSourceOnInvoice(
                invoice,
                sourcePaths[i]
            );

            const invoiceId = await invoiceRepository.create(invoice);
            await invoiceRepository.updateImagePath(invoiceId, userId, stored);

            await invoiceItemRepository.createMany(
                invoiceId,
                invoice.lineItems
            );

            await usageService.incrementInvoices(userId);

            invoice.id = invoiceId;
            savedInvoices.push(invoice);
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

    async getInvoices(userId, clientId = null) {

        if (clientId) {
            return await invoiceRepository.findByClient(
                userId,
                clientId
            );
        }

        return await invoiceRepository.findByUser(userId);
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
    async getInvoicesByClient(userId, clientId) {
        return await invoiceRepository.findByClient(
            userId,
            clientId
        );
     }
}

module.exports = FreeInvoiceAgent;