export const DOCUMENT_TYPES = [
  { value: "supplier_invoice", label: "Invoice" },
  { value: "bill", label: "Bill" },
];

export function documentTypeLabel(value) {
  return DOCUMENT_TYPES.find((t) => t.value === value)?.label || "-";
}

const BADGE_CLASSES = {
  supplier_invoice: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20",
  bill: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20",
};

export function documentTypeBadgeClass(value) {
  return (
    BADGE_CLASSES[value] ||
    "bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20"
  );
}
