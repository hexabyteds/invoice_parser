import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useTheme } from "../../hooks/useTheme";

export default function MonthlyExpensesChart({ data = [] }) {
  const { isDark } = useTheme();

  const gridColor = isDark ? "#1f2937" : "#e2e8f0";
  const axisColor = isDark ? "#94a3b8" : "#64748b";
  const tooltipBg = isDark ? "#111827" : "#ffffff";
  const tooltipBorder = isDark ? "#1f2937" : "#e2e8f0";
  const tooltipText = isDark ? "#e2e8f0" : "#0f172a";

  return (
    <div className="bg-white rounded-3xl shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-slate-900 mb-6">Monthly Expenses</h2>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
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
            />
            <Tooltip
              cursor={{ fill: isDark ? "#1e293b" : "#f1f5f9" }}
              formatter={(value) =>
                Number(value).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              }
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: 12,
                color: tooltipText,
              }}
            />
            <Bar dataKey="totalAmount" name="Expenses" radius={[8, 8, 0, 0]} animationDuration={800}>
              {data.map((_, i) => (
                <Cell key={i} fill="#7c3aed" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
