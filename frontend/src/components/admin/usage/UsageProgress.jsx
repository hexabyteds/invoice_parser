export default function UsageProgress({ used = 0, limit = 0, label }) {
  const safeUsed = Number(used || 0);
  const safeLimit = Number(limit || 0);
  const percentage =
    safeLimit > 0 ? Math.min((safeUsed / safeLimit) * 100, 100) : 0;

  let barColor = "bg-indigo-500";
  if (percentage >= 90) barColor = "bg-red-500";
  else if (percentage >= 70) barColor = "bg-amber-500";

  return (
    <div className="min-w-[120px]">
      {label && (
        <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      )}

      <div className="flex items-center justify-between text-xs text-slate-600">
        <span className="font-semibold text-slate-900">{safeUsed}</span>
        <span>/ {safeLimit}</span>
      </div>

      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <p className="mt-1 text-[11px] text-slate-400">
        {percentage.toFixed(0)}% used
      </p>
    </div>
  );
}
