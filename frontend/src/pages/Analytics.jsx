import { useEffect, useState } from "react";
import {
  FileText,
  DollarSign,
  Receipt,
  Calendar,
} from "lucide-react";

import { getAnalytics } from "../services/analyticsApi";

export default function Analytics() {

  const [analytics, setAnalytics] = useState(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {

    loadAnalytics();

  }, []);

  async function loadAnalytics() {

    try {

      const res = await getAnalytics();

      console.log(res.data);

      setAnalytics(res.data.analytics);

    } catch (err) {

      console.log(err);

    } finally {

      setLoading(false);

    }

  }

  if (loading) {

    return (
      <div className="bg-white rounded-3xl p-10 shadow">
        Loading analytics...
      </div>
    );

  }
  return (
    <div className="space-y-8">

      {/* Header */}

      <div>

        <h1 className="text-3xl font-bold text-slate-800">
          Analytics Dashboard
        </h1>

        <p className="text-slate-500 mt-2">
          Monitor your invoices and business performance.
        </p>

      </div>

      {/* KPI Cards */}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">

        <AnalyticsCard
          title="Total Invoices"
          value={analytics.totalInvoices}
          icon={<FileText size={24} />}
          color="blue"
        />

        <AnalyticsCard
          title="Revenue"
          value={`AED ${Number(
            analytics.totalRevenue
          ).toLocaleString()}`}
          icon={<DollarSign size={24} />}
          color="green"
        />

        <AnalyticsCard
          title="VAT"
          value={`AED ${Number(
            analytics.totalVAT
          ).toLocaleString()}`}
          icon={<Receipt size={24} />}
          color="orange"
        />

        <AnalyticsCard
          title="This Month"
          value={analytics.monthlyInvoices}
          icon={<Calendar size={24} />}
          color="purple"
        />

      </div>
      {/* Coming Soon */}

      <div className="bg-white rounded-3xl border shadow-sm p-10">

        <h2 className="text-2xl font-semibold mb-3">
          More Analytics Coming Soon
        </h2>

        <p className="text-slate-500">
          Monthly revenue charts, invoice trends,
          top clients, currencies, OCR confidence,
          and business insights will appear here.
        </p>

      </div>

    </div>
  );
}
function AnalyticsCard({
  title,
  value,
  icon,
  color,
}) {

  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (

    <div
      className="
        bg-white
        rounded-3xl
        border
        shadow-sm
        p-6
        hover:shadow-lg
        transition
      "
    >

      <div className="flex items-center justify-between">

        <div>

          <p className="text-slate-500 text-sm" style={{ color: "black" }}>
            {title}
          </p>

          <h2 className="text-3xl font-bold mt-3" style={{ color: "black" }}>
            {value}
          </h2>

        </div>

        <div
          className={`
            w-14
            h-14
            rounded-2xl
            flex
            items-center
            justify-center
            ${colors[color]}
          `}
        >
          {icon}
        </div>

      </div>

    </div>

  );
}