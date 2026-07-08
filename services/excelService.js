const ExcelJS = require("exceljs");

class ExcelService {

    async export(invoices, filePath = "invoices.xlsx") {

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Invoices");
        const lineSheet = workbook.addWorksheet("Line Items");

        worksheet.columns = [
            { header: "Client Name", key: "clientName", width: 25 },
            { header: "Invoice ID", key: "invoiceNo", width: 20 },
            { header: "Date", key: "invoiceDate", width: 15 },
            { header: "Description", key: "description", width: 40 },
            { header: "Subtotal", key: "subtotal", width: 14 },
            { header: "VAT %", key: "vatRate", width: 10 },
            { header: "VAT Amount", key: "vatAmount", width: 14 },
            { header: "Total", key: "totalAmount", width: 14 },
            { header: "Currency", key: "currency", width: 10 },
            { header: "Phone", key: "phoneNumber", width: 20 },
        ];

        lineSheet.columns = [
            { header: "Invoice ID", key: "invoiceNo", width: 20 },
            { header: "Client", key: "clientName", width: 25 },
            { header: "Description", key: "description", width: 40 },
            { header: "Qty", key: "quantity", width: 10 },
            { header: "Unit Price", key: "unitPrice", width: 14 },
            { header: "Amount", key: "amount", width: 14 },
            { header: "Currency", key: "currency", width: 10 },
        ];

        [worksheet, lineSheet].forEach((sheet) => {
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
            worksheet.addRow({
                clientName: invoice.clientName,
                invoiceNo: invoice.invoiceNo,
                invoiceDate: invoice.invoiceDate,
                description: invoice.description || "",
                subtotal: Number(invoice.subtotal || 0).toFixed(2),
                vatRate: invoice.vatRate || "",
                vatAmount: Number(invoice.vatAmount || 0).toFixed(2),
                totalAmount: Number(invoice.totalAmount).toFixed(2),
                currency: invoice.currency,
                phoneNumber: invoice.phoneNumber,
            });

            (invoice.lineItems || []).forEach((item) => {
                lineSheet.addRow({
                    invoiceNo: invoice.invoiceNo,
                    clientName: invoice.clientName,
                    description: item.description || "",
                    quantity: item.quantity || 0,
                    unitPrice: Number(item.unitPrice || 0).toFixed(2),
                    amount: Number(item.totalPrice || 0).toFixed(2),
                    currency: invoice.currency,
                });
            });
        });

        await workbook.xlsx.writeFile(filePath);

        console.log(`✅ Saved to ${filePath}`);

        return filePath;
    }

}

module.exports = new ExcelService();
