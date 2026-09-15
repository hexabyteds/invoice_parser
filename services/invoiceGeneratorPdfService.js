const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { calcInvoiceTotals } = require("../utils/invoiceCalc");

// pdf-lib's StandardFonts use WinAnsi encoding — drawText THROWS on any
// character outside it (e.g. Arabic, most emoji), which a UAE-focused
// public tool will hit routinely on real business/customer names. Strip
// rather than crash; this is a known v1 limitation (no non-Latin text in
// the rendered PDF), not silently-corrupted output.
function toWinAnsiSafe(value) {
  return String(value ?? "")
    .split("")
    .filter((ch) => ch.charCodeAt(0) <= 0xff)
    .join("")
    .trim();
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;

function formatMoney(amount, currency) {
  return `${currency} ${Number(amount).toFixed(2)}`;
}

async function generateInvoicePdf(data) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensureSpace = (needed = 18) => {
    if (y < MARGIN + needed) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const draw = (text, options = {}) => {
    const {
      size = 10,
      font: useFont = font,
      color = rgb(0.15, 0.15, 0.15),
      x = MARGIN,
      gap = 14,
      maxWidth = PAGE_WIDTH - MARGIN * 2,
    } = options;

    ensureSpace(gap);
    page.drawText(toWinAnsiSafe(text), { x, y, size, font: useFont, color, maxWidth });
    y -= gap;
  };

  const { business, customer, invoice, lineItems, totals } = data;

  // Header
  draw(business.name || "Your Business", { size: 18, font: bold, gap: 22 });
  if (business.trn) draw(`TRN: ${business.trn}`, { size: 9, color: rgb(0.4, 0.4, 0.4) });
  if (business.address) draw(business.address, { size: 9, color: rgb(0.4, 0.4, 0.4) });
  [business.city, business.country].filter(Boolean).forEach((line) =>
    draw(line, { size: 9, color: rgb(0.4, 0.4, 0.4) })
  );
  if (business.email) draw(business.email, { size: 9, color: rgb(0.4, 0.4, 0.4) });
  if (business.phone) draw(business.phone, { size: 9, color: rgb(0.4, 0.4, 0.4) });

  y -= 10;
  draw("INVOICE", { size: 14, font: bold, gap: 18 });
  draw(`Invoice #: ${invoice.invoiceNumber}`, { size: 10 });
  draw(`Invoice Date: ${invoice.invoiceDate}`, { size: 10 });
  if (invoice.dueDate) draw(`Due Date: ${invoice.dueDate}`, { size: 10 });
  if (invoice.poNumber) draw(`PO / Reference: ${invoice.poNumber}`, { size: 10 });

  y -= 10;
  draw("Bill To", { size: 11, font: bold, gap: 16 });
  if (customer.companyName) draw(customer.companyName, { size: 10 });
  if (customer.name) draw(customer.name, { size: 10 });
  if (customer.trn) draw(`TRN: ${customer.trn}`, { size: 9, color: rgb(0.4, 0.4, 0.4) });
  if (customer.billingAddress) draw(customer.billingAddress, { size: 9, color: rgb(0.4, 0.4, 0.4) });
  if (customer.email) draw(customer.email, { size: 9, color: rgb(0.4, 0.4, 0.4) });

  // Line items table
  y -= 12;
  ensureSpace(24);
  const cols = { desc: MARGIN, qty: 330, price: 390, discount: 455, total: 510 };
  draw("Description", { x: cols.desc, font: bold, size: 9, gap: 0 });
  draw("Qty", { x: cols.qty, font: bold, size: 9, gap: 0 });
  draw("Price", { x: cols.price, font: bold, size: 9, gap: 0 });
  draw("Disc.", { x: cols.discount, font: bold, size: 9, gap: 0 });
  draw("Total", { x: cols.total, font: bold, size: 9, gap: 16 });
  page.drawLine({
    start: { x: MARGIN, y: y + 6 },
    end: { x: PAGE_WIDTH - MARGIN, y: y + 6 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });

  for (const item of lineItems) {
    ensureSpace(16);
    const rowY = y;
    page.drawText(toWinAnsiSafe(item.description), {
      x: cols.desc,
      y: rowY,
      size: 9,
      font,
      maxWidth: cols.qty - cols.desc - 8,
    });
    page.drawText(String(item.quantity), { x: cols.qty, y: rowY, size: 9, font });
    page.drawText(formatMoney(item.unitPrice, invoice.currency), { x: cols.price, y: rowY, size: 9, font });
    page.drawText(item.discount ? formatMoney(item.discount, invoice.currency) : "-", {
      x: cols.discount,
      y: rowY,
      size: 9,
      font,
    });
    page.drawText(formatMoney(item.lineTotal, invoice.currency), { x: cols.total, y: rowY, size: 9, font });
    y -= 16;
  }

  // Totals
  y -= 10;
  ensureSpace(70);
  const totalsX = 400;
  draw("Subtotal", { x: totalsX, size: 10, gap: 0 });
  draw(formatMoney(totals.subtotal, invoice.currency), { x: 500, size: 10, gap: 16 });
  draw(`VAT (${totals.vatRate}%)`, { x: totalsX, size: 10, gap: 0 });
  draw(formatMoney(totals.vatAmount, invoice.currency), { x: 500, size: 10, gap: 18 });
  page.drawLine({
    start: { x: totalsX, y: y + 6 },
    end: { x: PAGE_WIDTH - MARGIN, y: y + 6 },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  draw("Total", { x: totalsX, font: bold, size: 12, gap: 0 });
  draw(formatMoney(totals.total, invoice.currency), { x: 500, font: bold, size: 12, gap: 20 });

  if (invoice.notes) {
    ensureSpace(30);
    draw("Notes", { size: 10, font: bold, gap: 14 });
    draw(invoice.notes, { size: 9, color: rgb(0.4, 0.4, 0.4) });
  }

  ensureSpace(20);
  draw("Generated with EazeeBooks — eazeebooks.com", { size: 8, color: rgb(0.6, 0.6, 0.6) });

  return pdfDoc.save();
}

module.exports = { generateInvoicePdf, toWinAnsiSafe };
