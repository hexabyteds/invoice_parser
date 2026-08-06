const ExcelJS = require("exceljs");

class ExcelService {

    async export(invoices, filePath = "invoices_" + new Date().toISOString().split("T")[0] + ".xlsx") {

        const workbook = new ExcelJS.Workbook();

        // One row per product / description (item-wise)
        const itemsSheet = workbook.addWorksheet("Line Items");

        // One row per invoice — totals only, no line items
        const summarySheet = workbook.addWorksheet("Invoice Summary");

        itemsSheet.columns = [
            { header: "Item ID", key: "itemId", width: 12 },
            { header: "Invoice ID", key: "invoiceNo", width: 20 },
            { header: "Client Name", key: "clientName", width: 28 },
            { header: "Date", key: "invoiceDate", width: 14 },
            { header: "Description", key: "description", width: 45 },
            { header: "Qty", key: "quantity", width: 10 },
            { header: "Unit Price", key: "unitPrice", width: 14 },
            { header: "Amount", key: "amount", width: 14 },
            { header: "VAT %", key: "vatRate", width: 10 },
            { header: "Currency", key: "currency", width: 10 },
        ];

        summarySheet.columns = [
            { header: "Invoice ID", key: "invoiceNo", width: 20 },
            { header: "Client Name", key: "clientName", width: 28 },
            { header: "Date", key: "invoiceDate", width: 14 },
            { header: "Amount Exc. VAT", key: "subtotal", width: 16 },
            { header: "VAT", key: "vatAmount", width: 14 },
            { header: "Amount Inc. VAT", key: "totalAmount", width: 16 },
            { header: "Currency", key: "currency", width: 10 },
        ];

        [itemsSheet, summarySheet].forEach((sheet) => {
            sheet.getRow(1).font = {
                bold: true,
                color: { argb: "FFFFFFFF" },
            };
            sheet.getRow(1).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "366092" },
            };
        });

        invoices.forEach((invoice) => {
            const lineItems = invoice.lineItems || [];
            const vatRate = invoice.vatRate || "";
            const date = invoice.invoiceDate
                ? formatExcelDate(invoice.invoiceDate)
                : "";

            if (lineItems.length > 0) {
                lineItems.forEach((item) => {
                    itemsSheet.addRow({
                        itemId: item.id || "",
                        invoiceNo: invoice.invoiceNo,
                        clientName: invoice.clientName,
                        invoiceDate: date,
                        description: item.description || "",
                        quantity: item.quantity || 0,
                        unitPrice: Number(item.unitPrice || 0).toFixed(2),
                        amount: Number(
                            item.totalPrice ?? item.amount ?? 0
                        ).toFixed(2),
                        vatRate,
                        currency: invoice.currency,
                    });
                });
            } else if (invoice.description) {
                // Fallback: split joined descriptions if no line items stored
                const parts = String(invoice.description)
                    .split(";")
                    .map((s) => s.trim())
                    .filter(Boolean);

                parts.forEach((description, index) => {
                    itemsSheet.addRow({
                        itemId: index + 1,
                        invoiceNo: invoice.invoiceNo,
                        clientName: invoice.clientName,
                        invoiceDate: date,
                        description,
                        quantity: "",
                        unitPrice: "",
                        amount: "",
                        vatRate,
                        currency: invoice.currency,
                    });
                });
            }

            summarySheet.addRow({
                invoiceNo: invoice.invoiceNo,
                clientName: invoice.clientName,
                invoiceDate: date,
                subtotal: Number(invoice.subtotal || 0).toFixed(2),
                vatAmount: Number(invoice.vatAmount || 0).toFixed(2),
                totalAmount: Number(invoice.totalAmount || 0).toFixed(2),
                currency: invoice.currency,
            });
        });

        await workbook.xlsx.writeFile(filePath);

        console.log(`✅ Saved to ${filePath}`);

        return filePath;
    }

}

function formatExcelDate(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("en-GB");
}

module.exports = new ExcelService();
