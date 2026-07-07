class StorageService {

    constructor() {
        this.invoices = [];
    }

    add(invoice) {
        this.invoices.push(invoice);
        return invoice;
    }

    getAll() {
        return this.invoices;
    }

    clear() {
        this.invoices = [];
    }

    getByInvoiceNo(invoiceNo) {
        return this.invoices.find(
            invoice => invoice.invoiceNo === invoiceNo
        );
    }

    getByClient(clientName) {
        return this.invoices.filter(
            invoice => invoice.clientName === clientName
        );
    }

    exists(invoiceNo) {
        return this.invoices.some(
            invoice => invoice.invoiceNo === invoiceNo
        );
    }

    getStats() {

        const totalAmount = this.invoices.reduce(
            (sum, invoice) => sum + Number(invoice.totalAmount),
            0
        );

        const totalVAT = this.invoices.reduce(
            (sum, invoice) => sum + Number(invoice.vatAmount),
            0
        );

        const uniqueClients = new Set(
            this.invoices.map(i => i.clientName)
        ).size;

        return {

            totalInvoices: this.invoices.length,

            uniqueClients,

            totalAmount: totalAmount.toFixed(2),

            totalVAT: totalVAT.toFixed(2),

            currency:
                this.invoices.length > 0
                    ? this.invoices[0].currency
                    : "AED",

            invoices: this.invoices

        };

    }

}

module.exports = new StorageService();