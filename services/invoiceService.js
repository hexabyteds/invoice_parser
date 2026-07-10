const fs = require("fs");
const GeminiService = require("./geminiService");
const validationService = require("./validationService");
const pdfService = require("./pdfService");
class InvoiceService {

    async extract(imagePath) {
        const result = await GeminiService.extractInvoice(imagePath);

        if (!result.success) {
            return result;
        }

        const g = result.invoice;

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

        const validation = validationService.validate(invoice);

        return {
            success: true,
            invoice,
            validation,
        };
    }

    async extractPDF_old(pdfPath) {

        const result = await GeminiService.extractInvoice(pdfPath);
    
        if (!result.success) {
            return result;
        }
    
        // Gemini may return either one object or an array
        const invoices = Array.isArray(result.invoice)
            ? result.invoice
            : [result.invoice];
    
        const extractedInvoices = [];
    
        for (const g of invoices) {
    
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
                    .map(i => i.description)
                    .filter(Boolean)
                    .join("; ")
            };
    
            extractedInvoices.push({
                invoice,
                validation: validationService.validate(invoice)
            });
        }
    
        return {
            success: true,
            invoices: extractedInvoices
        };
    }

    async extractPDF(pdfPath) {

        const pages = await pdfService.split(pdfPath);
    
        const invoices = [];
    
        for (const page of pages) {
    
            try {
    
                const result = await GeminiService.extractInvoice(page);
    
                if (!result.success) {
                    continue;
                }
    
                const g = result.invoice;
    
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
                        .map(i => i.description)
                        .filter(Boolean)
                        .join("; ")
                };
    
                const validation = validationService.validate(invoice);
    
                invoices.push({
                    invoice,
                    validation
                });
    
            } finally {
    
                // Delete the temporary single-page PDF
                if (fs.existsSync(page)) {
                    fs.unlinkSync(page);
                }
    
            }
        }
    
        return {
            success: true,
            invoices
        };
    }
}

module.exports = new InvoiceService();
