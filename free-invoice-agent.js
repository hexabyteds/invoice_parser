const invoiceService = require("./services/invoiceService");
const excelService = require("./services/excelService");
const reportService = require("./services/reportService");
const storageService = require("./services/storageService");

class FreeInvoiceAgent {

    async processImage(imagePath) {
        const result = await invoiceService.extract(imagePath);

        if (!result.success) {
            return {
                status: "error",
                message: result.error,
            };
        }

        storageService.add(result.invoice);

        return {
            status: "success",
            invoice: result.invoice,
            validation: result.validation,
        };
    }

    async saveToExcel(file = "invoices.xlsx") {
        return excelService.export(storageService.getAll(), file);
    }

    generateHTMLReport(file = "invoice_report.html") {
        return reportService.generate(storageService.getAll(), file);
    }

    getStats() {
        return storageService.getStats();
    }

    clear() {
        storageService.clear();
    }

}

module.exports = FreeInvoiceAgent;
