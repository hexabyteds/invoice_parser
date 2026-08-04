import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

const COLORS = {
  blue: { bg: "bg-blue-50", text: "text-blue-600", stroke: "#2563eb" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600", stroke: "#6366f1" },
  green: { bg: "bg-green-50", text: "text-green-600", stroke: "#16a34a" },
  orange: { bg: "bg-orange-50", text: "text-orange-600", stroke: "#ea580c" },
  purple: { bg: "bg-purple-50", text: "text-purple-600", stroke: "#9333ea" },
  pink: { bg: "bg-pink-50", text: "text-pink-600", stroke: "#db2777" },
  teal: { bg: "bg-teal-50", text: "text-teal-600", stroke: "#0d9488" },
};

export default function KpiCard({
  title,
  value,
  icon,
  color = "blue",
  trend = "flat",
  percent = 0,
  sparkline = [],
}) {
  const palette = COLORS[color] || COLORS.blue;

  const TrendIcon =
    trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;

  const trendColor =
    trend === "up" ? "text-emerald-500" : trend === "down" ? "text-rose-500" : "text-slate-400";

  const chartData = sparkline.map((v, i) => ({ i, v }));

  return (
    <div
      className="
        group relative overflow-hidden rounded-2xl border border-slate-200
        bg-white p-5 shadow-sm
        transition-all duration-300
        hover:-translate-y-1 hover:shadow-lg hover:border-slate-300
      "
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-slate-500 truncate">{title}</p>
          <p className="mt-2 text-2xl font-bold text-black truncate">{value}</p>

          <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon size={14} />
            <span>{Math.abs(percent)}%</span>
            <span className="text-slate-400 font-normal">vs last month</span>
          </div>
        </div>

        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${palette.bg} ${palette.text} transition-transform duration-300 group-hover:scale-110`}
        >
          {icon}
        </div>
      </div>

      {chartData.length > 1 && sparkline.some((v) => v > 0) && (
        <div className="mt-4 h-10 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette.stroke} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={palette.stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={palette.stroke}
                strokeWidth={2}
                fill={`url(#spark-${color})`}
                isAnimationActive
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
