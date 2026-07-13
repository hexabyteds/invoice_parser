const invoiceService = require("./services/invoiceService");
const excelService = require("./services/excelService");
const reportService = require("./services/reportService");
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
    // EXCEL
    // =========================

    async saveToExcel(
        userId,
        clientId = null,
        file = `invoices_${new Date().toISOString().split("T")[0]}.xlsx`
    ) {
        // clientId set  → only that client's invoices
        // clientId null → all invoices for this user
        const invoices = clientId
            ? await invoiceRepository.findByClient(userId, Number(clientId))
            : await invoiceRepository.findByUser(userId);

        console.log("Excel export:", {
            userId,
            clientId: clientId || "ALL",
            count: invoices.length,
        });

        return await excelService.export(invoices, file);
    }

    // =========================
    // HTML REPORT
    // =========================

    async generateHTMLReport(
        userId,
        clientId = null,
        file = "invoice_report.html"
    ) {

        const invoices = clientId
            ? await invoiceRepository.findByClient(
                  userId,
                  clientId
              )
            : await invoiceRepository.findByUser(userId);

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