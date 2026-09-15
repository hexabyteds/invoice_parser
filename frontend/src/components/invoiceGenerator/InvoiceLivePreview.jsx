function money(amount, currency) {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

// Pure presentational — the same computed totals feeding this preview are
// what gets sent to the server for the actual PDF, but the server
// recomputes them independently rather than trusting this render.
export default function InvoiceLivePreview({ business, customer, invoice, lineItems, totals }) {
  return (
    <div className="rounded-2xl bg-white p-8 text-slate-900 shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-lg font-bold">{business.name || "Your Business"}</p>
          {business.trn && <p className="text-xs text-slate-500">TRN: {business.trn}</p>}
          {business.address && <p className="text-xs text-slate-500">{business.address}</p>}
          {(business.city || business.country) && (
            <p className="text-xs text-slate-500">
              {[business.city, business.country].filter(Boolean).join(", ")}
            </p>
          )}
          {business.email && <p className="text-xs text-slate-500">{business.email}</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tracking-tight text-indigo-600">INVOICE</p>
          <p className="mt-1 text-sm text-slate-600">#{invoice.invoiceNumber || "INV-0001"}</p>
          <p className="text-xs text-slate-500">{invoice.invoiceDate}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-between gap-6 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bill To</p>
          <p className="mt-1 font-medium">
            {customer.companyName || customer.name || "Customer name"}
          </p>
          {customer.companyName && customer.name && (
            <p className="text-slate-500">{customer.name}</p>
          )}
          {customer.trn && <p className="text-xs text-slate-500">TRN: {customer.trn}</p>}
        </div>
        <div className="text-right">
          {invoice.dueDate && (
            <p>
              <span className="text-slate-400">Due Date: </span>
              {invoice.dueDate}
            </p>
          )}
          {invoice.poNumber && (
            <p>
              <span className="text-slate-400">PO/Ref: </span>
              {invoice.poNumber}
            </p>
          )}
        </div>
      </div>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Price</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="py-2 pr-2">{item.description || `Item ${i + 1}`}</td>
              <td className="py-2 text-right">{item.quantity || 0}</td>
              <td className="py-2 text-right">{money(item.unitPrice, invoice.currency)}</td>
              <td className="py-2 text-right">
                {money(
                  Math.max((item.quantity || 0) * (item.unitPrice || 0) - (item.discount || 0), 0),
                  invoice.currency
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="w-56 space-y-1 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{money(totals.subtotal, invoice.currency)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>VAT ({totals.vatRate}%)</span>
            <span>{money(totals.vatAmount, invoice.currency)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold">
            <span>Total</span>
            <span>{money(totals.total, invoice.currency)}</span>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">{invoice.notes}</p>
      )}
    </div>
  );
}
