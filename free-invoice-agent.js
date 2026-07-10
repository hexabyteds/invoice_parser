const invoiceService = require("./services/invoiceService");
const excelService = require("./services/excelService");
const reportService = require("./services/reportService");
const invoiceRepository = require("./repositories/invoiceRepository");
const invoiceNormalizer = require("./services/invoiceNormalizer");

const invoiceItemRepository = require("./repositories/invoiceItemRepository");
class FreeInvoiceAgent {

    async processImage(imagePath, userId) {

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
        result.invoice.user_id = userId;

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

    async saveToExcel(userId, file = "invoices_" + new Date().toISOString().split("T")[0] + ".xlsx") {

        const invoices = await invoiceRepository.findByUser(userId);
 

        return excelService.export(invoices, file);
    }

    async generateHTMLReport(userId, file = "invoice_report.html") {

        const invoices = await invoiceRepository.findAll();
    
        return reportService.generate(invoices, file);
    
    }

    async getStats(userId) {

        return await invoiceRepository.getStatistics(userId);

    }

    async clear(userId) {

        return await invoiceRepository.deleteAll(userId);

    }



    async getInvoices(userId) {
        return await invoiceRepository.findByUser(userId);
    }
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
            lineItems
        };
    
    }

    async getAnalytics(userId) {

        return await invoiceRepository.getAnalytics(userId);

    }   

    async processPDF(pdfPath, userId) {

        // We'll implement this next.
        const result = await invoiceService.extractPDF(pdfPath);

        if (!result.success) {
            return {
                status: "error",
                message: result.error,
            };
        }

        console.log("result.invoices", JSON.stringify(result.invoices, null, 2));
        const savedInvoices = [];
        
        for (const item of result.invoices) {
        
            const invoice = invoiceNormalizer.normalize(item.invoice);
        
            invoice.user_id = userId;
        
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
            totalInvoices: savedInvoices.length
        };
    }
}

module.exports = FreeInvoiceAgent;