const { formatDate } = require("../utils/dateUtils");

class InvoiceNormalizer {

    normalize(invoice) {

        return {

            ...invoice,

            invoiceDate: formatDate(invoice.invoiceDate),

            dueDate: formatDate(invoice.dueDate),

            subtotal: this.toNumber(invoice.subtotal),

            vatRate: this.toNumber(invoice.vatRate),

            vatAmount: this.toNumber(invoice.vatAmount),

            totalAmount: this.toNumber(invoice.totalAmount),

            currency: (invoice.currency || "AED").trim().toUpperCase(),

            invoiceNo: (invoice.invoiceNo || "").trim(),

            clientName: (invoice.clientName || "").trim(),

            sellerName: (invoice.sellerName || "").trim(),

            buyerName: (invoice.buyerName || "").trim(),

            phoneNumber: (invoice.phoneNumber || "").trim(),

            location: (invoice.location || "").trim(),

            description: (invoice.description || "").trim(),

            trn: (invoice.trn || "").trim(),

            lineItems: (invoice.lineItems || []).map(item => {

                const quantity = this.toNumber(item.quantity);
                const unitPrice = this.toNumber(item.unitPrice);
            
                return {
                    description: (item.description || "").trim(),
                    quantity,
                    unitPrice,
                    totalPrice: this.toNumber(item.totalPrice) || (quantity * unitPrice)
                };
            
            })
        };

    }

    toNumber(value) {

        if (value === null || value === undefined || value === "") {
            return 0;
        }

        if (typeof value === "number") {
            return value;
        }

        return parseFloat(
            String(value)
                .replace(/,/g, "")
                .replace(/[^\d.-]/g, "")
        ) || 0;
    }

}

module.exports = new InvoiceNormalizer();