import {
  Users,
  UserCheck,
  UserMinus,
  FileText,
  ScanText,
  HardDrive,
} from "lucide-react";

const cardConfig = [
  {
    key: "totalCustomers",
    title: "Customers",
    icon: Users,
    color: "from-violet-500 to-purple-600",
  },
  {
    key: "paidUsers",
    title: "Paid Users",
    icon: UserCheck,
    color: "from-emerald-500 to-teal-600",
  },
  {
    key: "freeUsers",
    title: "Free Users",
    icon: UserMinus,
    color: "from-amber-500 to-orange-600",
  },
  {
    key: "totalInvoices",
    title: "Invoices",
    icon: FileText,
    color: "from-blue-500 to-indigo-600",
  },
  {
    key: "totalOCR",
    title: "OCR Pages",
    icon: ScanText,
    color: "from-rose-500 to-pink-600",
  },
  {
    key: "totalStorage",
    title: "Storage Used",
    icon: HardDrive,
    color: "from-slate-600 to-slate-800",
    format: formatStorage,
  },
];

function formatStorage(bytes) {
  const value = Number(bytes || 0);

  if (value >= 1024 * 1024 * 1024) {
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
  if (value >= 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${value} B`;
}

function formatValue(card, summary) {
  const raw = summary?.[card.key] ?? 0;

  if (card.format) {
    return card.format(raw);
  }

  return Number(raw).toLocaleString();
}

export default function SummaryCards({ summary = {}, loading = false }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cardConfig.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.key}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">{card.title}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {loading ? "..." : formatValue(card, summary)}
                </p>
              </div>

              <div
                className={`rounded-xl bg-gradient-to-r ${card.color} p-2.5 text-white`}
              >
                <Icon size={20} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
