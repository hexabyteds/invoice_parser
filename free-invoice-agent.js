const invoiceService = require("./services/invoiceService");
const excelService = require("./services/excelService");
const reportService = require("./services/reportService");
const invoiceRepository = require("./repositories/invoiceRepository");
const invoiceNormalizer = require("./services/invoiceNormalizer");

const invoiceItemRepository = require("./repositories/invoiceItemRepository");
class FreeInvoiceAgent {

    async processImage(imagePath) {

        // Extract invoice using Gemini
        const result = await invoiceService.extract(imagePath);


        if (!result.success) {
            return {
                status: "error",
                message: result.error,
            };
        }
        result.invoice = invoiceNormalizer.normalize(result.invoice);

        // Temporary until authentication is implemented
        result.invoice.user_id = 1;

        // Save invoice into MySQL
        // await invoiceRepository.create(result.invoice);
        const invoiceId = await invoiceRepository.create(result.invoice);

        console.log(invoiceId);
        console.log(JSON.stringify(result.invoice.lineItems, null, 2));
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

    async saveToExcel(file = "invoices.xlsx") {

        const invoices = await invoiceRepository.findByUser(1);
 

        return excelService.export(invoices, file);
    }

    async generateHTMLReport(file = "invoice_report.html") {

        const invoices = await invoiceRepository.findAll();
    
        return reportService.generate(invoices, file);
    
    }

    async getStats() {

        return await invoiceRepository.getStatistics(1);

    }

    async clear() {

        return await invoiceRepository.deleteAll(1);

    }



    async getInvoices(userId = 1) {
        return await invoiceRepository.findByUser(userId);
    }

}

module.exports = FreeInvoiceAgent;