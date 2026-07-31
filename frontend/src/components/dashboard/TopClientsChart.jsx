import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Users } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

export default function TopClientsChart({ data = [] }) {
  const { isDark } = useTheme();

  const gridColor = isDark ? "#1f2937" : "#e2e8f0";
  const axisColor = isDark ? "#94a3b8" : "#64748b";
  const tooltipBg = isDark ? "#111827" : "#ffffff";
  const tooltipBorder = isDark ? "#1f2937" : "#e2e8f0";
  const tooltipText = isDark ? "#e2e8f0" : "#0f172a";

  return (
    <div className="bg-white rounded-3xl shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-black mb-6">
        Top Clients by Invoice Count
      </h2>

      {data.length === 0 ? (
        <div className="h-72 flex flex-col items-center justify-center text-slate-400">
          <Users size={36} />
          <p className="mt-3 text-sm">No invoices yet.</p>
        </div>
      ) : (
        <div style={{ height: Math.max(240, data.length * 44) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 20, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fill: axisColor, fontSize: 12 }}
                axisLine={{ stroke: gridColor }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="companyName"
                width={140}
                tick={{ fill: axisColor, fontSize: 12 }}
                axisLine={{ stroke: gridColor }}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: isDark ? "#1e293b" : "#f1f5f9" }}
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: 12,
                  color: tooltipText,
                }}
              />
              <Bar
                dataKey="invoiceCount"
                name="Invoices"
                fill="#2563eb"
                radius={[0, 8, 8, 0]}
                animationDuration={800}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
