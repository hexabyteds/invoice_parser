const GeminiService = require("./geminiService");
const validationService = require("./validationService");

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

}

module.exports = new InvoiceService();
