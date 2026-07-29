import {
  FileText,
  Users,
  ScanText,
  HardDrive,
  UserPlus,
} from "lucide-react";

const ICONS = {
  Invoices: FileText,
  Clients: Users,
  "OCR Pages": ScanText,
  Storage: HardDrive,
  "Team Members": UserPlus,
};

const ACCENTS = {
  Invoices: {
    icon: "bg-blue-50 text-blue-600",
    bar: "bg-blue-500",
    ring: "ring-blue-100",
  },
  Clients: {
    icon: "bg-emerald-50 text-emerald-600",
    bar: "bg-emerald-500",
    ring: "ring-emerald-100",
  },
  "OCR Pages": {
    icon: "bg-violet-50 text-violet-600",
    bar: "bg-violet-500",
    ring: "ring-violet-100",
  },
  Storage: {
    icon: "bg-amber-50 text-amber-600",
    bar: "bg-amber-500",
    ring: "ring-amber-100",
  },
  "Team Members": {
    icon: "bg-rose-50 text-rose-600",
    bar: "bg-rose-500",
    ring: "ring-rose-100",
  },
};

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function formatValue(title, value, isLimit = false) {
  if (title === "Storage") {
    return isLimit ? `${value} MB` : formatBytes(value);
  }
  return value;
}

export default function UsageCard({ title, used, limit, remaining }) {
  const Icon = ICONS[title] || FileText;
  const accent = ACCENTS[title] || ACCENTS.Invoices;

 
  const percentage =
    limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  let barColor = accent.bar;
  if (percentage >= 90) barColor = "bg-red-500";
  else if (percentage >= 70) barColor = "bg-amber-500";

  const isNearLimit = percentage >= 90;

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md ring-1 ${accent.ring}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">
              {formatValue(title, used)}
            </span>
            <span className="text-sm text-slate-400">
              / {formatValue(title, limit, true)}
            </span>
          </div>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accent.icon}`}
        >
          <Icon size={22} />
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-500">Usage</span>
          <span
            className={`font-semibold ${
              isNearLimit ? "text-red-600" : "text-slate-700"
            }`}
          >
            {percentage.toFixed(0)}%
          </span>
        </div>

        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
        <span className="text-sm text-slate-500">Remaining</span>
        <span className="text-sm font-semibold text-slate-900">
          {formatValue(title, remaining)}
        </span>
      </div>
    </div>
  );
}
