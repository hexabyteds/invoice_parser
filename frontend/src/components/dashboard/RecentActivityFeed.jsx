import {
  UploadCloud,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserPlus,
  Activity,
} from "lucide-react";

const ACTION_META = {
  invoice_uploaded: {
    label: "Invoice Uploaded",
    icon: <UploadCloud size={16} />,
    tone: "bg-blue-100 text-blue-600",
  },
  invoice_processed: {
    label: "OCR Completed",
    icon: <CheckCircle2 size={16} />,
    tone: "bg-green-100 text-green-600",
  },
  invoice_rejected: {
    label: "Invoice Rejected",
    icon: <XCircle size={16} />,
    tone: "bg-red-100 text-red-600",
  },
  invoice_error: {
    label: "Processing Error",
    icon: <AlertTriangle size={16} />,
    tone: "bg-amber-100 text-amber-600",
  },
  client_added: {
    label: "Client Added",
    icon: <UserPlus size={16} />,
    tone: "bg-purple-100 text-purple-600",
  },
};

function timeAgo(dateString) {
  if (!dateString) return "-";

  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(dateString).toLocaleDateString();
}

export default function RecentActivityFeed({ activity = [] }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-black mb-4">Recent Activity</h2>

      {activity.length === 0 ? (
        <div className="py-8 text-center text-slate-400">
          <Activity size={32} className="mx-auto" />
          <p className="mt-3 text-sm">No activity yet.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {activity.map((item) => {
            const meta = ACTION_META[item.action] || {
              label: item.action,
              icon: <Activity size={16} />,
              tone: "bg-slate-100 text-slate-500",
            };

            return (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition"
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.tone}`}
                >
                  {meta.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-black">{meta.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {item.clientName || item.description || ""}
                  </p>
                </div>

                <span className="text-xs text-slate-400 shrink-0">
                  {timeAgo(item.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
