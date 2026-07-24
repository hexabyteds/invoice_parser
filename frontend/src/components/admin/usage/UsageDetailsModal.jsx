import { X } from "lucide-react";
import UsageProgress from "./UsageProgress";

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

export default function UsageDetailsModal({ customer, onClose }) {
  if (!customer) return null;

  const metrics = [
    {
      label: "Invoices",
      used: customer.invoices_used,
      limit: customer.invoice_limit,
    },
    {
      label: "Clients",
      used: customer.clients_used,
      limit: customer.client_limit,
    },
    {
      label: "OCR Pages",
      used: customer.ocr_pages_used,
      limit: customer.ocr_limit,
    },
    {
      label: "Team Members",
      used: customer.team_members_used,
      limit: customer.user_limit,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {customer.name}
            </h2>
            <p className="text-sm text-slate-500">{customer.email}</p>
            {customer.company_name && (
              <p className="mt-1 text-sm text-slate-400">
                {customer.company_name}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
            {customer.plan_name} plan
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {metrics.map((metric) => (
              <UsageProgress
                key={metric.label}
                label={metric.label}
                used={metric.used}
                limit={metric.limit}
              />
            ))}
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-sm font-medium text-slate-500">Storage</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {formatBytes(customer.storage_used)}{" "}
              <span className="text-sm font-normal text-slate-400">
                / {customer.storage_limit} MB
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
