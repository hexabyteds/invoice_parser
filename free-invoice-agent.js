const invoiceService = require("./services/invoiceService");
const excelService = require("./services/excelService");
const reportService = require("./services/reportService");
const exportFormatsService = require("./services/exportFormatsService");
const invoiceNormalizer = require("./services/invoiceNormalizer");

const invoiceRepository = require("./repositories/invoiceRepository");
const invoiceItemRepository = require("./repositories/invoiceItemRepository");

class FreeInvoiceAgent {

    // =========================
    // IMAGE
    // =========================

    async processImage(imagePath, userId, clientId) {

        const result = await invoiceService.extract(imagePath);

        if (!result.success) {
            return {
                status: "error",
                message: result.error,
            };
        }

        result.invoice = invoiceNormalizer.normalize(result.invoice);

        result.invoice.user_id = userId;
        result.invoice.client_id = clientId;

        const invoiceId = await invoiceRepository.create(result.invoice);

        await invoiceItemRepository.createMany(
            invoiceId,
            result.invoice.lineItems
        );

        return {
            status: "success",
            invoice: result.invoice,
            validation: result.validation,
        };
    }

    // =========================
    // PDF
    // =========================

    async processPDF(pdfPath, userId, clientId) {

        const result = await invoiceService.extractPDF(pdfPath);

        if (!result.success) {
            return {
                status: "error",
                message: result.error,
            };
        }

        const savedInvoices = [];

        for (const item of result.invoices) {

            const invoice = invoiceNormalizer.normalize(item.invoice);

            invoice.user_id = userId;
            invoice.client_id = clientId;

            const invoiceId = await invoiceRepository.create(invoice);

            await invoiceItemRepository.createMany(
                invoiceId,
                invoice.lineItems
            );

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