const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

// CSV/formula injection (CWE-1236): a cell whose value starts with =, +,
// -, or @ is interpreted by Excel/Sheets/LibreOffice as a formula when the
// file is opened, not as literal text — e.g. a client name of
// =HYPERLINK("http://evil.example","Click me") executes on open. Prefixing
// with a leading single quote is the standard mitigation (OWASP CSV
// Injection); Excel treats the cell as text and doesn't display the quote.
// This also affects negative numbers (they start with "-"), which is an
// accepted, standard trade-off of this fix, not a bug — the cell reads
// the same either way, just as text instead of a formatted number.
function escapeCsv(value) {
    let str = value == null ? "" : String(value);

    if (/^[=+\-@]/.test(str)) {
        str = `'${str}`;
    }

    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function formatDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString().split("T")[0];
}

function formatDateDisplay(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("en-GB");
}

function formatMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "0.00";

    const rounded =
        Math.sign(amount) *
        (Math.round((Math.abs(amount) + Number.EPSILON) * 100) / 100);

    return rounded.toFixed(2);
}

function roundMoney(value) {
    return Number(formatMoney(value));
}

function rowsToCsv(headers, rows) {
    return [
        headers.map(escapeCsv).join(","),
        ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\n");
}

function getItems(invoice) {
    if (invoice.lineItems?.length) return invoice.lineItems;
    return [
        {
            description: invoice.description || "Invoice item",
            quantity: 1,
            unitPrice: invoice.totalAmount || 0,
            totalPrice: invoice.totalAmount || 0,
        },
    ];
}

class ExportFormatsService {

    // Generic CSV (one row per line item)
    toStandardCsv(invoices) {
        const headers = [
            "Invoice No",
            "Client",
            "Invoice Date",
            "Due Date",
            "Subtotal",
            "VAT Rate",
            "VAT Amount",
            "Total Amount",
            "Currency",
            "TRN",
            "Phone",
            "Location",
            "Description",
            "Item Description",
            "Qty",
            "Unit Price",
            "Item Total",
        ];

        const rows = [];

        for (const invoice of invoices) {
            for (const item of getItems(invoice)) {
                rows.push([
                    invoice.invoiceNo,
                    invoice.clientName,
                    formatDate(invoice.invoiceDate),
                    formatDate(invoice.dueDate),
                    formatMoney(invoice.subtotal),
                    invoice.vatRate,
                    formatMoney(invoice.vatAmount),
                    formatMoney(invoice.totalAmount),
                    invoice.currency,
                    invoice.trn,
                    invoice.phoneNumber,
                    invoice.location,
                    invoice.description,
                    item.description,
                    item.quantity,
                    formatMoney(item.unitPrice),
                    formatMoney(item.totalPrice),
                ]);
            }
        }

        return rowsToCsv(headers, rows);
    }

    // Zoho Books Bills export — exact columns from Bill.xlsx template
    // Only fill fields we have; everything else stays empty.
    async toZohoBillsExcel(invoices, filePath) {
        const ExcelJS = require("exceljs");

        const headers = [
            "Bill Date",
            "Due Date",
            "Bill ID",
            "Vendor Name",
            "Entity Discount Percent",
            "Payment Terms",
            "Payment Terms Label",
            "Bill Number",
            "PurchaseOrder",
            "Currency Code",
            "Exchange Rate",
            "SubTotal",
            "Total",
            "Balance",
            "TotalRetentionAmountFCY",
            "TotalRetentionAmountBCY",
            "Vendor Notes",
            "Terms & Conditions",
            "Adjustment",
            "Adjustment Description",
            "Bill Type",
            "Is Inclusive Tax",
            "Submitted By",
            "Approved By",
            "Submitted Date",
            "Approved Date",
            "Bill Status",
            "Created By",
            "TIN Number",
            "Buyer ID Authority",
            "Legal Name",
            "Product ID",
            "Item Name",
            "Account",
            "Account Code",
            "Description",
            "Quantity",
            "Tax Amount",
            "Item Total",
            "Is Billable",
            "VAT Treatment",
            "Place Of Supply",
            "Tax Registration Number",
            "Rate",
            "Discount Type",
            "Is Discount Before Tax",
            "Discount",
            "Discount Amount",
            "Purchase Order Number",
            "Tax ID",
            "Tax Name",
            "Tax Percentage",
            "Tax Type",
            "Item Exemption Code",
            "Out of Scope Reason",
            "Item Type",
            "Reverse Charge Tax Name",
            "Reverse Charge Tax Rate",
            "Reverse Charge Tax Type",
            "ITC Eligibility",
            "Entity Discount Amount",
            "Discount Account",
            "Discount Account Code",
            "Item Discount Account",
            "Item Discount Account Code",
            "Is Landed Cost",
            "Customer Name",
            "Project Name",
        ];

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Bills");

        sheet.addRow(headers);
        sheet.getRow(1).font = { bold: true };

        const val = (v) =>
            v === null || v === undefined || v === "" ? "" : v;

        for (const invoice of invoices) {
            const items = invoice.lineItems?.length
                ? invoice.lineItems
                : [{}];

            for (const item of items) {
                sheet.addRow([
                    val(formatDate(invoice.invoiceDate)), // Bill Date
                    val(formatDate(invoice.dueDate)), // Due Date
                    "", // Bill ID (Zoho internal)
                    val(invoice.clientName), // Vendor Name
                    "", // Entity Discount Percent
                    "", // Payment Terms
                    "", // Payment Terms Label
                    val(invoice.invoiceNo), // Bill Number
                    "", // PurchaseOrder
                    val(invoice.currency), // Currency Code
                    "", // Exchange Rate
                    roundMoney(invoice.subtotal), // SubTotal
                    roundMoney(invoice.totalAmount), // Total
                    "", // Balance
                    "", // TotalRetentionAmountFCY
                    "", // TotalRetentionAmountBCY
                    val(invoice.description), // Vendor Notes
                    "", // Terms & Conditions
                    "", // Adjustment
                    "", // Adjustment Description
                    "", // Bill Type
                    "", // Is Inclusive Tax
                    "", // Submitted By
                    "", // Approved By
                    "", // Submitted Date
                    "", // Approved Date
                    "", // Bill Status
                    "", // Created By
                    val(invoice.trn), // TIN Number
                    "", // Buyer ID Authority
                    "", // Legal Name
                    "", // Product ID
                    val(item.description), // Item Name
                    "", // Account
                    "", // Account Code
                    val(item.description), // Description
                    val(item.quantity), // Quantity
                    "", // Tax Amount (per-item tax not stored)
                    roundMoney(item.totalPrice), // Item Total
                    "", // Is Billable
                    "", // VAT Treatment
                    val(invoice.location), // Place Of Supply
                    val(invoice.trn), // Tax Registration Number
                    roundMoney(item.unitPrice), // Rate
                    "", // Discount Type
                    "", // Is Discount Before Tax
                    "", // Discount
                    "", // Discount Amount
                    "", // Purchase Order Number
                    "", // Tax ID
                    "", // Tax Name
                    val(invoice.vatRate), // Tax Percentage
                    "", // Tax Type
                    "", // Item Exemption Code
                    "", // Out of Scope Reason
                    "", // Item Type
                    "", // Reverse Charge Tax Name
                    "", // Reverse Charge Tax Rate
                    "", // Reverse Charge Tax Type
                    "", // ITC Eligibility
                    "", // Entity Discount Amount
                    "", // Discount Account
                    "", // Discount Account Code
                    "", // Item Discount Account
                    "", // Item Discount Account Code
                    "", // Is Landed Cost
                    "", // Customer Name
                    "", // Project Name
                ]);
            }
        }

        // Reasonable column widths for readability
        headers.forEach((_, i) => {
            sheet.getColumn(i + 1).width = Math.min(
                Math.max(String(headers[i]).length + 2, 12),
                28
            );
        });

        // Keep monetary cells numeric while displaying exactly two decimals.
        [12, 13, 39, 44].forEach((column) => {
            sheet.getColumn(column).numFmt = "0.00";
        });

        const outPath =
            filePath ||
            path.join(process.cwd(), `zoho_bills_${Date.now()}.xlsx`);

        await workbook.xlsx.writeFile(outPath);
        return outPath;
    }

    // Kept for reference / CSV download of same Zoho Bills columns
    toZohoCsv(invoices) {
        const headers = [
            "Bill Date",
            "Due Date",
            "Bill ID",
            "Vendor Name",
            "Entity Discount Percent",
            "Payment Terms",
            "Payment Terms Label",
            "Bill Number",
            "PurchaseOrder",
            "Currency Code",
            "Exchange Rate",
            "SubTotal",
            "Total",
            "Balance",
            "TotalRetentionAmountFCY",
            "TotalRetentionAmountBCY",
            "Vendor Notes",
            "Terms & Conditions",
            "Adjustment",
            "Adjustment Description",
            "Bill Type",
            "Is Inclusive Tax",
            "Submitted By",
            "Approved By",
            "Submitted Date",
            "Approved Date",
            "Bill Status",
            "Created By",
            "TIN Number",
            "Buyer ID Authority",
            "Legal Name",
            "Product ID",
            "Item Name",
            "Account",
            "Account Code",
            "Description",
            "Quantity",
            "Tax Amount",
            "Item Total",
            "Is Billable",
            "VAT Treatment",
            "Place Of Supply",
            "Tax Registration Number",
            "Rate",
            "Discount Type",
            "Is Discount Before Tax",
            "Discount",
            "Discount Amount",
            "Purchase Order Number",
            "Tax ID",
            "Tax Name",
            "Tax Percentage",
            "Tax Type",
            "Item Exemption Code",
            "Out of Scope Reason",
            "Item Type",
            "Reverse Charge Tax Name",
            "Reverse Charge Tax Rate",
            "Reverse Charge Tax Type",
            "ITC Eligibility",
            "Entity Discount Amount",
            "Discount Account",
            "Discount Account Code",
            "Item Discount Account",
            "Item Discount Account Code",
            "Is Landed Cost",
            "Customer Name",
            "Project Name",
        ];

        const val = (v) =>
            v === null || v === undefined || v === "" ? "" : v;

        const rows = [];

        for (const invoice of invoices) {
            const items = invoice.lineItems?.length
                ? invoice.lineItems
                : [{}];

            for (const item of items) {
                rows.push([
                    val(formatDate(invoice.invoiceDate)),
                    val(formatDate(invoice.dueDate)),
                    "",
                    val(invoice.clientName),
                    "",
                    "",
                    "",
                    val(invoice.invoiceNo),
                    "",
                    val(invoice.currency),
                    "",
                    formatMoney(invoice.subtotal),
                    formatMoney(invoice.totalAmount),
                    "",
                    "",
                    "",
                    val(invoice.description),
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    val(invoice.trn),
                    "",
                    "",
                    "",
                    val(item.description),
                    "",
                    "",
                    val(item.description),
                    val(item.quantity),
                    "",
                    formatMoney(item.totalPrice),
                    "",
                    "",
                    val(invoice.location),
                    val(invoice.trn),
                    formatMoney(item.unitPrice),
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    val(invoice.vatRate),
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                ]);
            }
        }

        return rowsToCsv(headers, rows);
    }

    // QuickBooks Online invoice import CSV
    toQuickBooksCsv(invoices) {
        const headers = [
            "InvoiceNo",
            "Customer",
            "InvoiceDate",
            "DueDate",
            "Terms",
            "Location",
            "Memo",
            "Item(Product/Service)",
            "ItemDescription",
            "ItemQuantity",
            "ItemRate",
            "ItemAmount",
            "Taxable",
            "TaxRate",
            "TaxAmount",
            "Service Date",
            "Currency",
        ];

        const rows = [];

        for (const invoice of invoices) {
            const items = getItems(invoice);
            const itemCount = items.length || 1;

            for (const item of items) {
                const qty = Number(item.quantity) || 0;
                const rate = Number(item.unitPrice) || 0;
                const amount = Number(item.totalPrice) || qty * rate;
                const lineVat =
                    itemCount > 0
                        ? Number(invoice.vatAmount || 0) / itemCount
                        : 0;

                rows.push([
                    invoice.invoiceNo || "",
                    invoice.clientName || "",
                    formatDate(invoice.invoiceDate),
                    formatDate(invoice.dueDate),
                    "Net 30",
                    invoice.location || "",
                    invoice.description || "",
                    item.description || "Services",
                    item.description || "",
                    qty,
                    formatMoney(rate),
                    formatMoney(amount),
                    Number(invoice.vatRate) > 0 ? "Y" : "N",
                    invoice.vatRate ?? 0,
                    formatMoney(lineVat),
                    formatDate(invoice.invoiceDate),
                    invoice.currency || "AED",
                ]);
            }
        }

        return rowsToCsv(headers, rows);
    }

    // Multi-invoice PDF summary
    async toPdf(invoices, filePath) {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const pageWidth = 595;
        const pageHeight = 842;
        const margin = 40;
        let page = pdfDoc.addPage([pageWidth, pageHeight]);
        let y = pageHeight - margin;

        const ensureSpace = (needed = 18) => {
            if (y < margin + needed) {
                page = pdfDoc.addPage([pageWidth, pageHeight]);
                y = pageHeight - margin;
            }
        };

        const draw = (text, options = {}) => {
            const {
                size = 11,
                font: useFont = font,
                color = rgb(0.1, 0.1, 0.1),
                x = margin,
                gap = 16,
            } = options;

            ensureSpace(gap);
            page.drawText(String(text ?? ""), {
                x,
                y,
                size,
                font: useFont,
                color,
                maxWidth: pageWidth - margin * 2,
            });
            y -= gap;
        };

        draw("Invoice Export Report", {
            size: 20,
            font: bold,
            gap: 24,
        });

        draw(`Generated: ${new Date().toLocaleString("en-GB")}`, {
            size: 10,
            color: rgb(0.4, 0.4, 0.4),
            gap: 12,
        });

        draw(`Total invoices: ${invoices.length}`, {
            size: 11,
            font: bold,
            gap: 22,
        });

        if (!invoices.length) {
            draw("No invoices found for the selected filters.");
        }

        for (const invoice of invoices) {
            ensureSpace(120);

            page.drawLine({
                start: { x: margin, y: y + 8 },
                end: { x: pageWidth - margin, y: y + 8 },
                thickness: 1,
                color: rgb(0.85, 0.85, 0.85),
            });

            draw(`${invoice.invoiceNo || "Invoice"}  ·  ${invoice.clientName || "-"}`, {
                size: 13,
                font: bold,
                gap: 18,
            });

            draw(
                `Date: ${formatDateDisplay(invoice.invoiceDate)}   Due: ${formatDateDisplay(invoice.dueDate)}   Currency: ${invoice.currency || "-"}`,
                { size: 10, gap: 14 }
            );

            draw(
                `Subtotal: ${formatMoney(invoice.subtotal)}   VAT (${invoice.vatRate || 0}%): ${formatMoney(invoice.vatAmount)}   Total: ${formatMoney(invoice.totalAmount)}`,
                { size: 10, font: bold, gap: 16 }
            );

            if (invoice.trn) {
                draw(`TRN: ${invoice.trn}`, { size: 10, gap: 14 });
            }

            const items = getItems(invoice).slice(0, 12);

            for (const item of items) {
                draw(
                    `• ${item.description || "Item"}  |  Qty ${item.quantity ?? 0}  |  ${formatMoney(item.unitPrice)}  |  ${formatMoney(item.totalPrice)}`,
                    { size: 9, color: rgb(0.25, 0.25, 0.25), gap: 13, x: margin + 8 }
                );
            }

            if ((invoice.lineItems || []).length > 12) {
                draw(`… and ${(invoice.lineItems || []).length - 12} more items`, {
                    size: 9,
                    color: rgb(0.45, 0.45, 0.45),
                    gap: 16,
                    x: margin + 8,
                });
            }

            y -= 8;
        }

        const bytes = await pdfDoc.save();
        const outPath =
            filePath ||
            path.join(
                process.cwd(),
                `invoices_export_${Date.now()}.pdf`
            );

        fs.writeFileSync(outPath, bytes);
        return outPath;
    }
}

module.exports = new ExportFormatsService();
