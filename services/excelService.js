const ExcelJS = require("exceljs");

class ExcelService {

    async export(invoices, filePath = "invoices.xlsx") {

        const workbook = new ExcelJS.Workbook();

        // One row per product / description (item-wise)
        const itemsSheet = workbook.addWorksheet("Line Items");

        // One row per invoice (summary totals)
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
            { header: "Items", key: "itemCount", width: 10 },
            { header: "Subtotal", key: "subtotal", width: 14 },
            { header: "VAT %", key: "vatRate", width: 10 },
            { header: "VAT Amount", key: "vatAmount", width: 14 },
            { header: "Total", key: "totalAmount", width: 14 },
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

        // invoices.forEach((invoice) => {
        //     const lineItems = invoice.lineItems || [];
        //     const vatRate = invoice.vatRate || "";
        //     const date = invoice.invoiceDate
        //         ? formatExcelDate(invoice.invoiceDate)
        //         : "";

        //     if (lineItems.length > 0) {
        //         lineItems.forEach((item) => {
        //             itemsSheet.addRow({
        //                 itemId: item.id || "",
        //                 invoiceNo: invoice.invoiceNo,
        //                 clientName: invoice.clientName,
        //                 invoiceDate: date,
        //                 description: item.description || "",
        //                 quantity: item.quantity || 0,
        //                 unitPrice: Number(item.unitPrice || 0).toFixed(2),
        //                 amount: Number(
        //                     item.totalPrice ?? item.amount ?? 0
        //                 ).toFixed(2),
        //                 vatRate,
        //                 currency: invoice.currency,
        //             });
        //         });
        //     } else if (invoice.description) {
        //         // Fallback: split joined descriptions if no line items stored
        //         const parts = String(invoice.description)
        //             .split(";")
        //             .map((s) => s.trim())
        //             .filter(Boolean);

        //         parts.forEach((description, index) => {
        //             itemsSheet.addRow({
        //                 itemId: index + 1,
        //                 invoiceNo: invoice.invoiceNo,
        //                 clientName: invoice.clientName,
        //                 invoiceDate: date,
        //                 description,
        //                 quantity: "",
        //                 unitPrice: "",
        //                 amount: "",
        //                 vatRate,
        //                 currency: invoice.currency,
        //             });
        //         });
        //     }

        //     summarySheet.addRow({
        //         invoiceNo: invoice.invoiceNo,
        //         clientName: invoice.clientName,
        //         invoiceDate: date,
        //         itemCount: lineItems.length || (
        //             invoice.description
        //                 ? String(invoice.description).split(";").filter((s) => s.trim()).length
        //                 : 0
        //         ),
        //         subtotal: Number(invoice.subtotal || 0).toFixed(2),
        //         vatRate,
        //         vatAmount: Number(invoice.vatAmount || 0).toFixed(2),
        //         totalAmount: Number(invoice.totalAmount || 0).toFixed(2),
        //         currency: invoice.currency,
        //     });
        // });


        invoices.forEach((invoice) => {

            const sheet = workbook.addWorksheet(
                invoice.invoiceNo.substring(0, 25)
            );
        
            sheet.columns = [
                { width: 45 },
                { width: 15 },
                { width: 18 },
                { width: 18 }
            ];
        
            // Title
        
            sheet.mergeCells("A1:D1");
        
            sheet.getCell("A1").value = "Invoice Details";
        
            sheet.getCell("A1").font = {
                bold: true,
                size: 20
            };
        
            sheet.getCell("A1").alignment = {
                horizontal: "center"
            };
        
            // Information
        
            sheet.addRow([]);
            sheet.addRow(["Invoice Number", invoice.invoiceNo]);
            sheet.addRow(["Client", invoice.clientName]);
            sheet.addRow(["Invoice Date", formatExcelDate(invoice.invoiceDate)]);
            sheet.addRow(["Currency", invoice.currency]);
            sheet.addRow(["TRN", invoice.trn]);
            sheet.addRow(["Phone", invoice.phoneNumber]);
            sheet.addRow(["Location", invoice.location]);
        
            sheet.addRow([]);
        
            // Table Header
        
            const header = sheet.addRow([
                "Description",
                "Qty",
                "Unit Price",
                "Total"
            ]);
        
            header.font = {
                bold: true,
                color: { argb: "FFFFFFFF" }
            };
        
            header.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "366092" }
            };
        
            // Items
        
            (invoice.lineItems || []).forEach(item => {
        
                sheet.addRow([
                    item.description,
                    item.quantity,
                    item.unitPrice,
                    item.totalPrice
                ]);
        
            });
        
            sheet.addRow([]);
        
            sheet.addRow([
                "",
                "",
                "Subtotal",
                invoice.subtotal
            ]);
        
            sheet.addRow([
                "",
                "",
                "VAT (" + invoice.vatRate + "%)",
                invoice.vatAmount
            ]);
        
            const total = sheet.addRow([
                "",
                "",
                "Grand Total",
                invoice.totalAmount
            ]);
        
            total.font = {
                bold: true
            };
        
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
