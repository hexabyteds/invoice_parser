import { Eye } from "lucide-react";
import UsageProgress from "./UsageProgress";

function formatStorageCell(usedBytes, limitMb) {
  const used = Number(usedBytes || 0);
  const limitBytes = Number(limitMb || 0) * 1024 * 1024;
  const percentage =
    limitBytes > 0 ? Math.min((used / limitBytes) * 100, 100) : 0;

  let barColor = "bg-violet-500";
  if (percentage >= 90) barColor = "bg-red-500";
  else if (percentage >= 70) barColor = "bg-amber-500";

  const formatBytes = (bytes) => {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="min-w-[120px]">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span className="font-semibold text-slate-900">
          {formatBytes(used)}
        </span>
        <span>/ {limitMb} MB</span>
      </div>

      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <p className="mt-1 text-[11px] text-slate-400">
        {percentage.toFixed(0)}% used
      </p>
    </div>
  );
}

export default function UsageRow({ customer, onView }) {
  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50">
      <td className="px-6 py-4">
        <div className="font-semibold text-slate-900">{customer.name}</div>
        <div className="text-xs text-slate-500">{customer.email}</div>
        {customer.company_name && (
          <div className="mt-0.5 text-xs text-slate-400">
            {customer.company_name}
          </div>
        )}
      </td>

      <td className="px-4 py-4">
        <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-medium capitalize text-violet-700">
          {customer.plan_name || "—"}
        </span>
      </td>

      <td className="px-4 py-4">
        <UsageProgress
          used={customer.invoices_used}
          limit={customer.invoice_limit}
        />
      </td>

      <td className="px-4 py-4">
        <UsageProgress
          used={customer.clients_used}
          limit={customer.client_limit}
        />
      </td>

      <td className="px-4 py-4">
        <UsageProgress
          used={customer.ocr_pages_used}
          limit={customer.ocr_limit}
        />
      </td>

      <td className="px-4 py-4">
        {formatStorageCell(customer.storage_used, customer.storage_limit)}
      </td>

      <td className="px-6 py-4 text-center">
        <button
          type="button"
          onClick={() => onView(customer)}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50"
        >
          <Eye size={16} />
          View
        </button>
      </td>
    </tr>
  );
}
