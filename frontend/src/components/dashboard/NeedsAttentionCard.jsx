import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, Gauge, XCircle, ArrowRight } from "lucide-react";

export default function NeedsAttentionCard({ data }) {
  const navigate = useNavigate();

  const items = [
    {
      label: "Failed Documents",
      value: data?.failedInvoices ?? 0,
      icon: <XCircle size={18} />,
      tone: "text-red-600 bg-red-50",
    },
    {
      label: "Pending OCR",
      value: data?.pendingOCR ?? 0,
      icon: <Clock size={18} />,
      tone: "text-amber-600 bg-amber-50",
    },
    {
      label: "Low Confidence Extraction",
      value: data?.lowConfidenceExtraction ?? 0,
      icon: <Gauge size={18} />,
      tone: "text-orange-600 bg-orange-50",
    },
    {
      label: "Processing Errors",
      value: data?.processingErrors ?? 0,
      icon: <AlertTriangle size={18} />,
      tone: "text-rose-600 bg-rose-50",
    },
  ];

  const totalIssues = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white rounded-3xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-black">Needs Attention</h2>
        {totalIssues > 0 ? (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            {totalIssues} to review
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            All clear
          </span>
        )}
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.tone}`}>
                {item.icon}
              </div>
              <span className="text-sm font-medium text-slate-700">{item.label}</span>
            </div>
            <span className="text-lg font-bold text-black">{item.value}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate("/dashboard/invoices")}
        className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-black font-medium transition"
      >
        View Issues
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
