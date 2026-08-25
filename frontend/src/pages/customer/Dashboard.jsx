import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  FileText,
  DollarSign,
  Receipt,
  Wallet,
  Loader2,
} from "lucide-react";

import { uploadInvoice } from "../../services/invoiceApi";
import customerApi from "../../services/customerApi";
import dashboardApi from "../../services/dashboardApi";

import KpiCard from "../../components/dashboard/KpiCard";
import NeedsAttentionCard from "../../components/dashboard/NeedsAttentionCard";
import MonthlyProcessingChart from "../../components/dashboard/MonthlyProcessingChart";
import RecentActivityFeed from "../../components/dashboard/RecentActivityFeed";
import DashboardSkeleton from "../../components/dashboard/DashboardSkeleton";
import { isPartyActive } from "../../utils/clientStatus";

function formatCurrency(value) {
  return `AED ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState({ invoices: [], clients: [] });
  const [needsAttention, setNeedsAttention] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const [clientId, setClientId] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);

      const [clientRes, summaryRes, monthlyRes, qualityRes, activityRes] =
        await Promise.all([
          customerApi.getAll(),
          dashboardApi.getSummary(),
          dashboardApi.getMonthly(),
          dashboardApi.getQuality(),
          dashboardApi.getActivity(),
        ]);

      setClients(clientRes.customers || []);
      setSummary(summaryRes.data.summary);
      setMonthly(monthlyRes.data.monthly);
      setNeedsAttention(qualityRes.data.needsAttention);
      setActivity(activityRes.data.activity || []);
    } catch (err) {
      // Individual widgets already render sensible empty states from
      // their default prop values, so a partial/total load failure here
      // just leaves the dashboard looking empty rather than broken.
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickUpload() {
    if (!file) {
      setUploadError("Please select a file.");
      return;
    }

    if (!clientId) {
      setUploadError("Please select a customer.");
      return;
    }

    const selectedClient = clients.find((c) => String(c.id) === String(clientId));
    if (selectedClient && !isPartyActive(selectedClient.status)) {
      setUploadError(
        "This customer is inactive. Please activate the customer before adding documents."
      );
      return;
    }

    try {
      setUploading(true);
      setUploadError("");
      setUploadMsg("");

      const formData = new FormData();
      formData.append("image", file);
      formData.append("client_id", clientId);

      const res = await uploadInvoice(formData);

      if (res.data?.invoices) {
        setUploadMsg(
          `${res.data.totalInvoices} invoice(s) imported successfully.`
        );
      } else {
        setUploadMsg(
          `Invoice ${res.data?.invoice?.invoiceNo || ""} uploaded successfully.`
        );
      }

      setFile(null);
      await loadDashboard();
    } catch (err) {
      setUploadError(
        err.response?.data?.error || "Unable to upload invoice."
      );
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  const selectedQuickUploadClient = clients.find((c) => String(c.id) === String(clientId));
  const quickUploadClientInactive =
    Boolean(selectedQuickUploadClient) && !isPartyActive(selectedQuickUploadClient.status);

  const last6 = (arr, key) => (arr || []).slice(-6).map((row) => Number(row?.[key] || 0));
  const invoiceSeries = monthly.invoices || [];

  const avgValueSeries = invoiceSeries
    .slice(-6)
    .map((m) => (m.uploaded ? m.totalAmount / m.uploaded : 0));

  return (
    <div className="space-y-8">

      {/* Welcome Banner */}
      <section className="rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white p-8 shadow-xl overflow-hidden relative">
        <div className="absolute -right-16 -top-16 w-60 h-60 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10">
          <h1 className="text-4xl font-bold font-display tracking-tight">Welcome back</h1>

          <p className="mt-3 text-indigo-100 max-w-2xl">
            Manage invoices, upload documents, analyze results and
            download reports from one dashboard.
          </p>

          <div className="flex flex-wrap gap-3 mt-8">
            <button
              onClick={() => navigate("/dashboard/upload")}
              className="px-6 py-3 rounded-xl bg-white text-indigo-700 font-semibold hover:shadow-xl transition"
            >
              Upload Documents
            </button>

            <button
              onClick={() => navigate("/dashboard/reports")}
              className="px-6 py-3 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition"
            >
              View Reports & Analysis
            </button>
          </div>
        </div>
      </section>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <KpiCard
          title="Total Documents"
          value={summary?.totalInvoices.value.toLocaleString()}
          icon={<FileText size={20} />}
          color="indigo"
          trend={summary?.totalInvoices.trend}
          percent={summary?.totalInvoices.percent}
          sparkline={last6(invoiceSeries, "uploaded")}
        />
        <KpiCard
          title="Total Value"
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
          title="Average Document Value"
          value={formatCurrency(summary?.avgInvoiceValue.value)}
          icon={<Wallet size={20} />}
          color="pink"
          trend={summary?.avgInvoiceValue.trend}
          percent={summary?.avgInvoiceValue.percent}
          sparkline={avgValueSeries}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left column */}
        <div className="xl:col-span-2 space-y-6">

          {/* Needs Attention */}
          <NeedsAttentionCard data={needsAttention} />

          {/* Document processing trend */}
          <MonthlyProcessingChart data={invoiceSeries} title="Document Processing Trend" />
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Quick Upload */}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              Quick Upload
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Select Customer
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select Customer</option>
                {clients.map((client) => (
                  <option
                    key={client.id}
                    value={client.id}
                    disabled={!isPartyActive(client.status)}
                  >
                    {client.company_name}
                    {!isPartyActive(client.status) ? " (Inactive)" : ""}
                  </option>
                ))}
              </select>

              {quickUploadClientInactive && (
                <div className="mt-3 rounded-xl bg-red-50 text-red-600 p-3 text-sm">
                  This customer is inactive. Please activate the customer before adding documents.
                </div>
              )}
            </div>

            <label className="block border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition">
              <input
                type="file"
                hidden
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setFile(e.target.files[0]);
                    setUploadError("");
                    setUploadMsg("");
                  }
                }}
              />
              <UploadCloud className="mx-auto text-indigo-600" size={36} />
              <p className="mt-3 font-medium text-slate-900">
                {file ? file.name : "Choose PDF / Image"}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                JPG, PNG, PDF supported
              </p>
            </label>

            {uploadError && (
              <div className="mt-4 rounded-xl bg-red-50 text-red-600 p-3 text-sm">
                {uploadError}
              </div>
            )}

            {uploadMsg && (
              <div className="mt-4 rounded-xl bg-green-50 text-green-700 p-3 text-sm">
                {uploadMsg}
              </div>
            )}

            <button
              disabled={uploading || quickUploadClientInactive}
              onClick={handleQuickUpload}
              className="mt-4 w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-all shadow-lg shadow-indigo-950/30"
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Processing...
                </>
              ) : (
                <>
                  <UploadCloud size={18} />
                  Upload Documents
                </>
              )}
            </button>

            <button
              onClick={() => navigate("/dashboard/upload")}
              className="mt-3 w-full text-indigo-600 text-sm font-medium hover:underline"
            >
              Open full upload page
            </button>
          </div>

          {/* Recent Activity */}
          <RecentActivityFeed activity={activity} />
        </div>
      </div>
    </div>
  );
}
