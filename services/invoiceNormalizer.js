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

            buyerTrn: (invoice.buyerTrn || "").trim(),

            buyerPhone: (invoice.buyerPhone || "").trim(),

            buyerEmail: (invoice.buyerEmail || "").trim(),

            buyerAddress: (invoice.buyerAddress || "").trim(),

            phoneNumber: (invoice.phoneNumber || "").trim(),

            location: (invoice.location || "").trim(),

            description: (invoice.description || "").trim(),

            trn: (invoice.trn || "").trim(),

            lineItems: (invoice.lineItems || []).map(item => {

                const quantity = this.toNumber(item.quantity);
                const unitPrice = this.toNumber(item.unitPrice);

                // Gemini's own extraction schema names this field `amount`
                // (services/geminiService.js), never `totalPrice` — checking
                // only `item.totalPrice` meant it was never populated and
                // this silently discarded Gemini's real extracted line
                // total on every upload, always recomputing qty*unitPrice
                // instead (wrong whenever a line's real total legitimately
                // differs, e.g. a per-line discount or lump-sum pricing).
                // `totalPrice` is still checked first for any caller that
                // already provides it directly (e.g. a manual edit).
                // Presence, not truthiness, decides the fallback — a
                // genuinely zero-value line item (a free/waived item) must
                // stay 0, not get silently replaced by a recomputed total.
                const extractedTotal = item.totalPrice ?? item.amount;
                const hasExtractedTotal =
                    extractedTotal !== undefined && extractedTotal !== null && extractedTotal !== "";

                return {
                    description: (item.description || "").trim(),
                    quantity,
                    unitPrice,
                    totalPrice: hasExtractedTotal ? this.toNumber(extractedTotal) : quantity * unitPrice
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