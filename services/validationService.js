class ValidationService {

    validate(invoice) {
        const errors = [];
        const warnings = [];

        if (!invoice.clientName?.trim()) {
            errors.push("Missing vendor/client name");
        }

        if (!invoice.invoiceNo?.trim()) {
            warnings.push("Missing invoice number");
        }

        if (!invoice.invoiceDate) {
            warnings.push("Missing invoice date");
        }

        if (!invoice.totalAmount || Number(invoice.totalAmount) <= 0) {
            errors.push("Missing or invalid total amount");
        }

        if (!invoice.lineItems?.length && !invoice.description?.trim()) {
            warnings.push("No product/service details found");
        }

        const fields = [
            "clientName",
            "invoiceNo",
            "invoiceDate",
            "dueDate",
            "phoneNumber",
            "location",
            "subtotal",
            "vatAmount",
            "totalAmount",
            "description",
            "trn",
        ];

        const filled = fields.filter((field) => {
            const value = invoice[field];
            if (value === undefined || value === null || value === "") {
                return false;
            }
            if (typeof value === "number" && Number.isNaN(value)) {
                return false;
            }
            return true;
        }).length;

        const confidence = Math.round((filled / fields.length) * 100);

        return {
            isValid: errors.length === 0,
            confidence,
            errors,
            warnings,
        };
    }

}

module.exports = new ValidationService();
