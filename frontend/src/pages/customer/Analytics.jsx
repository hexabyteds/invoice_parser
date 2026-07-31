import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FileText,
  DollarSign,
  Receipt,
  Calendar,
  Users,
  Wallet,
  FileSpreadsheet,
  FileText as FileTextIcon,
  Printer,
  Eye,
  Loader2,
} from "lucide-react";

import clientApi from "../../services/clientApi";
import dashboardApi from "../../services/dashboardApi";
import { getInvoices, getInvoicesByClient } from "../../services/invoiceApi";
import { downloadExcel, openHtmlReport } from "../../services/reportApi";

import KpiCard from "../../components/dashboard/KpiCard";
import MonthlyProcessingChart from "../../components/dashboard/MonthlyProcessingChart";
import MonthlyExpensesChart from "../../components/dashboard/MonthlyExpensesChart";
import TopClientsChart from "../../components/dashboard/TopClientsChart";
import ConfidenceDistributionChart from "../../components/dashboard/ConfidenceDistributionChart";
import DashboardSkeleton from "../../components/dashboard/DashboardSkeleton";

function formatCurrency(value) {
  return `AED ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function Analytics() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [clientId, setClientId] = useState(searchParams.get("client") || "");
  const [clients, setClients] = useState([]);

  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState({ invoices: [], clients: [] });
  const [topClients, setTopClients] = useState([]);
  const [confidenceDistribution, setConfidenceDistribution] = useState(null);
  const [invoices, setInvoices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    const fromUrl = searchParams.get("client") || "";
    if (fromUrl !== clientId) {
      setClientId(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    loadAnalytics(clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function loadClients() {
    try {
      const res = await clientApi.getAll();
      setClients(res.clients || []);
    } catch (err) {
      // handled by empty state
    }
  }

  async function loadAnalytics(selectedClientId) {
    try {
      setLoading(true);

      const numericClientId = selectedClientId ? Number(selectedClientId) : null;

      const [summaryRes, monthlyRes, confidenceRes, invoiceRes, topClientsRes] =
        await Promise.all([
          dashboardApi.getSummary(numericClientId),
          dashboardApi.getMonthly(numericClientId),
          dashboardApi.getConfidenceDistribution(numericClientId),
          numericClientId
            ? getInvoicesByClient(numericClientId)
            : getInvoices(),
          numericClientId ? Promise.resolve(null) : dashboardApi.getTopClients(),
        ]);

      setSummary(summaryRes.data.summary);
      setMonthly(monthlyRes.data.monthly);
      setConfidenceDistribution(confidenceRes.data.distribution);
      setInvoices(invoiceRes?.data?.invoices || []);
      setTopClients(topClientsRes?.data?.topClients || []);
    } catch (err) {
      // Widgets already render sensible empty states from default values.
    } finally {
      setLoading(false);
    }
  }

  function handleClientChange(value) {
    setClientId(value);
    if (value) {
      setSearchParams({ client: value });
    } else {
      setSearchParams({});
    }
  }

  async function handleExport(type) {
    try {
      setExporting(type);
      const filters = clientId ? { clientId } : {};

      if (type === "excel") {
        const res = await downloadExcel(filters);
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement("a");
        link.href = url;
        link.download = "Invoices.xlsx";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else if (type === "html") {
        openHtmlReport(filters);
      } else if (type === "print") {
        window.print();
      }
    } catch (err) {
      // Best-effort export — no dedicated error UI for this action yet.
    } finally {
      setExporting("");
    }
  }

  const selectedClient = clients.find((c) => String(c.id) === String(clientId));
  const invoiceSeries = monthly.invoices || [];
  const clientSeries = monthly.clients || [];
  const last6 = (arr, key) => (arr || []).slice(-6).map((row) => Number(row?.[key] || 0));
  const avgValueSeries = invoiceSeries
    .slice(-6)
    .map((m) => (m.uploaded ? m.totalAmount / m.uploaded : 0));

  if (loading && !summary) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-black">Reports & Analytics</h1>
          <p className="text-slate-500 mt-2">
            {selectedClient
              ? `Reports and analytics for ${selectedClient.company_name}`
              : "Export data and monitor your invoices and business performance."}
          </p>
        </div>

        {/* <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleExport("excel")}
            disabled={exporting === "excel"}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-medium transition disabled:opacity-60"
          >
            {exporting === "excel" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={18} />
            )}
            Download Excel
          </button>

          <button
            onClick={() => handleExport("html")}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-medium transition"
          >
            <FileTextIcon size={18} />
            HTML Report
          </button>

          <button
            onClick={() => handleExport("print")}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-medium transition"
          >
            <Printer size={18} />
            Print
          </button>
        </div> */}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="md:w-72">
          <label className="block mb-2 text-sm font-semibold text-black">
            Select Client
          </label>
          <select
            value={clientId}
            onChange={(e) => handleClientChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-black"
          >
            <option value="">All Clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.company_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        <KpiCard
          title="Total Invoices"
          value={summary?.totalInvoices.value.toLocaleString()}
          icon={<FileText size={20} />}
          color="blue"
          trend={summary?.totalInvoices.trend}
          percent={summary?.totalInvoices.percent}
          sparkline={last6(invoiceSeries, "uploaded")}
        />
        <KpiCard
          title="Total Expenses"
          value={formatCurrency(summary?.totalExpenses.value)}
          icon={<DollarSign size={20} />}
          color="green"
          trend={summary?.totalExpenses.trend}
          percent={summary?.totalExpenses.percent}
          sparkline={last6(invoiceSeries, "totalAmount")}
        />
        <KpiCard
          title="Total VAT"
          value={formatCurrency(summary?.totalVAT.value)}
          icon={<Receipt size={20} />}
          color="orange"
          trend={summary?.totalVAT.trend}
          percent={summary?.totalVAT.percent}
          sparkline={last6(invoiceSeries, "vatAmount")}
        />
        <KpiCard
          title="This Month"
          value={summary?.thisMonth.value.toLocaleString()}
          icon={<Calendar size={20} />}
          color="teal"
          trend={summary?.thisMonth.trend}
          percent={summary?.thisMonth.percent}
          sparkline={last6(invoiceSeries, "uploaded")}
        />
        <KpiCard
          title="Avg Invoice Value"
          value={formatCurrency(summary?.avgInvoiceValue.value)}
          icon={<Wallet size={20} />}
          color="pink"
          trend={summary?.avgInvoiceValue.trend}
          percent={summary?.avgInvoiceValue.percent}
          sparkline={avgValueSeries}
        />
        {summary?.totalClients && (
          <KpiCard
            title="Total Clients"
            value={summary.totalClients.value.toLocaleString()}
            icon={<Users size={20} />}
            color="purple"
            trend={summary.totalClients.trend}
            percent={summary.totalClients.percent}
            sparkline={last6(clientSeries, "count")}
          />
        )}
      </div>

      {/* Charts */}
      <MonthlyProcessingChart data={invoiceSeries} />
      <MonthlyExpensesChart data={invoiceSeries} />

      <div className={`grid gap-6 ${clientId ? "" : "md:grid-cols-2"}`}>
        {!clientId && <TopClientsChart data={topClients} />}
        <ConfidenceDistributionChart data={confidenceDistribution} />
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-3xl shadow border overflow-hidden">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold text-black">Recent Invoices</h2>
          <button
            onClick={() => navigate("/dashboard/invoices")}
            className="text-blue-600 text-sm font-medium hover:underline"
          >
            View all
          </button>
        </div>

        {invoices.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            No invoices yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-4 font-medium text-black">Invoice</th>
                  <th className="text-left px-6 py-4 font-medium text-black">Client</th>
                  <th className="text-left px-6 py-4 font-medium text-black">Date</th>
                  <th className="text-right px-6 py-4 font-medium text-black">Amount</th>
                  <th className="text-center px-6 py-4 font-medium text-black">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.slice(0, 10).map((invoice) => (
                  <tr key={invoice.id} className="border-t hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-black">{invoice.invoiceNo}</td>
                    <td className="px-6 py-4 font-medium text-black">{invoice.clientName}</td>
                    <td className="px-6 py-4 font-medium text-black">
                      {invoice.invoiceDate
                        ? new Date(invoice.invoiceDate).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-black">
                      {invoice.currency} {Number(invoice.totalAmount || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <button
                          onClick={() => navigate(`/dashboard/invoices/${invoice.id}`)}
                          className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
