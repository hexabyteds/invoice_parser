// Backend (CommonJS) mirror of frontend/src/utils/invoiceCalc.js — the
// two can't share a module across the Vite/ESM frontend and CommonJS
// backend, so this is kept deliberately tiny and identical in logic. The
// backend copy is authoritative: the public invoice-generator API
// recomputes totals from raw line items itself rather than trusting
// whatever the client-side preview already calculated.
function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function calcLineTotal(quantity, unitPrice, discount = 0) {
  const gross = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  return round2(Math.max(gross - (Number(discount) || 0), 0));
}

function calcInvoiceTotals(lineItems, vatRatePercent, vatMode = "exclusive") {
  const grossSubtotal = round2(lineItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const vatRate = Number(vatRatePercent) || 0;

  if (vatMode === "inclusive") {
    const subtotal = round2(grossSubtotal / (1 + vatRate / 100));
    const vatAmount = round2(grossSubtotal - subtotal);
    return { subtotal, vatAmount, total: grossSubtotal, vatRate, vatMode };
  }

  const vatAmount = round2((grossSubtotal * vatRate) / 100);
  return {
    subtotal: grossSubtotal,
    vatAmount,
    total: round2(grossSubtotal + vatAmount),
    vatRate,
    vatMode,
  };
}

module.exports = { round2, calcLineTotal, calcInvoiceTotals };
