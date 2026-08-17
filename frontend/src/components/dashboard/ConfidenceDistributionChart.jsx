import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useTheme } from "../../hooks/useTheme";

const SEGMENTS = [
  { key: "high", name: "High (80-100%)", color: "#16a34a" },
  { key: "medium", name: "Medium (50-79%)", color: "#d97706" },
  { key: "low", name: "Low (<50%)", color: "#dc2626" },
];

export default function ConfidenceDistributionChart({ data }) {
  const { isDark } = useTheme();

  const tooltipBg = isDark ? "#111827" : "#ffffff";
  const tooltipBorder = isDark ? "#1f2937" : "#e2e8f0";
  const tooltipText = isDark ? "#e2e8f0" : "#0f172a";
  const axisColor = isDark ? "#94a3b8" : "#64748b";

  const chartData = SEGMENTS.map((s) => ({
    ...s,
    value: Number(data?.[s.key] || 0),
  }));

  const total = chartData.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="bg-white rounded-3xl shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-slate-900 mb-6">
        Extraction Confidence Distribution
      </h2>

      {total === 0 ? (
        <div className="h-72 flex items-center justify-center text-slate-400 text-sm">
          No invoices yet.
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={3}
                animationDuration={800}
              >
                {chartData.map((s) => (
                  <Cell key={s.key} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  `${value} invoice(s) (${Math.round((value / total) * 100)}%)`,
                  name,
                ]}
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: 12,
                  color: tooltipText,
                }}
              />
              <Legend
                verticalAlign="bottom"
                wrapperStyle={{ fontSize: 12, color: axisColor }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
