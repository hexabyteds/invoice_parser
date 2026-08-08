export const DOCUMENT_TYPES = [
  { value: "supplier_invoice", label: "Invoice" },
  { value: "bill", label: "Bill" },
  { value: "bank_statement", label: "Bank Statement" },
];

// Edit-only contexts (the invoice edit form) must never offer "Bank
// Statement" — bank statements aren't stored in the invoices table and
// the backend rejects that value on PUT /api/invoices/:id.
export const INVOICE_DOCUMENT_TYPES = DOCUMENT_TYPES.filter(
  (t) => t.value !== "bank_statement"
);

export function documentTypeLabel(value) {
  return DOCUMENT_TYPES.find((t) => t.value === value)?.label || "-";
}

const BADGE_CLASSES = {
  supplier_invoice: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20",
  bill: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20",
  bank_statement: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20",
};

export function documentTypeBadgeClass(value) {
  return (
    BADGE_CLASSES[value] ||
    "bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20"
  );
}
