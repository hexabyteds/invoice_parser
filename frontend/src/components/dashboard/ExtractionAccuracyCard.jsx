import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function ExtractionAccuracyCard({ data }) {
  const navigate = useNavigate();

  const totalSuccessfullyExtracted = data?.totalSuccessfullyExtracted ?? 0;
  const hasData = totalSuccessfullyExtracted > 0;

  const overallAccuracy = data?.overallAccuracy ?? 0;
  const avgConfidenceScore = data?.avgConfidenceScore ?? 0;
  const successRate = hasData ? data?.successRate ?? 0 : null;

  const tone =
    overallAccuracy >= 80 ? "emerald" : overallAccuracy >= 50 ? "amber" : "red";

  const toneClasses = {
    emerald: { bar: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
    amber: { bar: "bg-amber-500", badge: "bg-amber-100 text-amber-700" },
    red: { bar: "bg-red-500", badge: "bg-red-100 text-red-700" },
  }[tone];

  return (
    <div className="bg-white rounded-3xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-black">Extraction Accuracy</h2>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${toneClasses.badge}`}>
          {overallAccuracy}%
        </span>
      </div>

      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mb-6">
        <div
          className={`h-full rounded-full ${toneClasses.bar}`}
          style={{ width: `${Math.max(0, Math.min(100, overallAccuracy))}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Avg. Confidence" value={hasData ? `${avgConfidenceScore}/100` : "-"} />
        <Stat label="Success Rate" value={successRate === null ? "-" : `${successRate}%`} />
        <Stat label="Successfully Extracted" value={totalSuccessfullyExtracted} span />
      </div>

      <button
        onClick={() => navigate("/dashboard/analytics")}
        className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-black font-medium transition"
      >
        View Analytics
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

function Stat({ label, value, span }) {
  return (
    <div className={`p-3 rounded-xl bg-slate-50 ${span ? "col-span-2" : ""}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-black">{value}</p>
    </div>
  );
}
