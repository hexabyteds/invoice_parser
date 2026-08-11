import { CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";

// Surfaces the backend's validationService output (confidence/errors/
// warnings) so a low-confidence or incomplete extraction is visible to the
// user right where they'd act on it — the upload result and the invoice
// detail view — instead of looking identical to a clean extraction.
export default function ExtractionQualityCard({ validation }) {
  if (!validation) return null;

  const { confidence, errors = [], warnings = [] } = validation;

  const tone =
    errors.length > 0
      ? "red"
      : confidence >= 80
        ? "emerald"
        : confidence >= 50
          ? "amber"
          : "red";

  const toneClasses = {
    emerald: { bar: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
    amber: { bar: "bg-amber-500", badge: "bg-amber-100 text-amber-700" },
    red: { bar: "bg-red-500", badge: "bg-red-100 text-red-700" },
  }[tone];

  return (
    <div className="bg-white rounded-3xl shadow border p-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Extraction Confidence
        </h2>
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold ${toneClasses.badge}`}
        >
          {confidence}%
        </span>
      </div>

      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mb-5">
        <div
          className={`h-full rounded-full ${toneClasses.bar}`}
          style={{ width: `${Math.max(0, Math.min(100, confidence))}%` }}
        />
      </div>

      {errors.length > 0 && (
        <div className="mb-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-600">
            <AlertCircle size={16} />
            Needs attention
          </p>
          <ul className="mt-2 ml-6 list-disc text-sm text-red-600 space-y-1">
            {errors.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-600">
            <AlertTriangle size={16} />
            Worth double-checking
          </p>
          <ul className="mt-2 ml-6 list-disc text-sm text-amber-600 space-y-1">
            {warnings.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {errors.length === 0 && warnings.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle2 size={16} />
          All expected fields look complete.
        </p>
      )}
    </div>
  );
}
