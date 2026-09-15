// Single source of truth for invoice totals — the same subtotal/VAT/total
// formula previously existed separately (and slightly differently) in
// EditInvoice.jsx and InvoiceDetails.jsx. Rounding to 2dp after every
// intermediate step (not just the final display) keeps floating-point
// drift from compounding across many line items.
export function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function calcLineTotal(quantity, unitPrice) {
  return round2((Number(quantity) || 0) * (Number(unitPrice) || 0));
}

// vatMode: "exclusive" (VAT added on top of subtotal) or "inclusive"
// (vatRate% of the entered amounts is already baked in, so it's backed out
// instead of added). Exclusive matches the only mode the rest of the app
// currently supports (see EditInvoice.jsx); inclusive is new for the
// public generator per its own spec.
export function calcInvoiceTotals(lineItems, vatRatePercent, vatMode = "exclusive") {
  const lineTotal = (item) => calcLineTotal(item.quantity, item.unitPrice);
  const grossSubtotal = round2(lineItems.reduce((sum, item) => sum + lineTotal(item), 0));
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
