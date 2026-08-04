import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "../../hooks/useTheme";

export default function MonthlyProcessingChart({ data = [] }) {
  const { isDark } = useTheme();

  const gridColor = isDark ? "#1f2937" : "#e2e8f0";
  const axisColor = isDark ? "#94a3b8" : "#64748b";
  const tooltipBg = isDark ? "#111827" : "#ffffff";
  const tooltipBorder = isDark ? "#1f2937" : "#e2e8f0";
  const tooltipText = isDark ? "#e2e8f0" : "#0f172a";

  return (
    <div className="bg-white rounded-3xl shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-black mb-6">
        Monthly Invoice Processing
      </h2>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="uploaded" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="processed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="failed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#dc2626" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: axisColor, fontSize: 12 }}
              axisLine={{ stroke: gridColor }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: axisColor, fontSize: 12 }}
              axisLine={{ stroke: gridColor }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: 12,
                color: tooltipText,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 13, color: axisColor }} />

            <Area
              type="monotone"
              dataKey="uploaded"
              name="Uploaded"
              stroke="#6366f1"
              fill="url(#uploaded)"
              strokeWidth={2}
              animationDuration={800}
            />
            <Area
              type="monotone"
              dataKey="processed"
              name="Processed"
              stroke="#16a34a"
              fill="url(#processed)"
              strokeWidth={2}
              animationDuration={800}
            />
            <Area
              type="monotone"
              dataKey="failed"
              name="Failed"
              stroke="#dc2626"
              fill="url(#failed)"
              strokeWidth={2}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
