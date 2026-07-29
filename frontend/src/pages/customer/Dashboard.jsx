import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  FileText,
  DollarSign,
  Receipt,
  Eye,
  Loader2,
  Clock,
  CheckCircle2,
  ArrowRight,
  Users,
} from "lucide-react";

import { getInvoices, uploadInvoice } from "../../services/invoiceApi";
import { getAnalytics } from "../../services/analyticsApi";
import clientApi from "../../services/clientApi";

export default function Dashboard() {
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [analytics, setAnalytics] = useState(null);
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

      const [invoiceRes, analyticsRes, clientRes] = await Promise.all([
        getInvoices(),
        getAnalytics(),
        clientApi.getAll(),
      ]);

      setInvoices(invoiceRes.data.invoices || []);
      setAnalytics(analyticsRes.data.analytics || {});
      setClients(clientRes.clients || []);
    } catch (err) {
   
    } finally {
      setLoading(false);
    }
  }

  const recentInvoices = invoices.slice(0, 6);

  const activity = invoices.slice(0, 8).map((invoice) => ({
    id: invoice.id,
    title: invoice.invoiceNo || "Invoice",
    client: invoice.clientName || "Unknown client",
    amount: `${invoice.currency || "AED"} ${Number(
      invoice.totalAmount || 0
    ).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    date: invoice.invoiceDate
      ? new Date(invoice.invoiceDate).toLocaleDateString()
      : "-",
  }));

  async function handleQuickUpload() {
    if (!file) {
      setUploadError("Please select a file.");
      return;
    }

    if (!clientId) {
      setUploadError("Please select a client.");
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

  const totalInvoices = Number(analytics?.totalInvoices || 0);
  const totalRevenue = Number(analytics?.totalRevenue || 0);
  const totalVAT = Number(analytics?.totalVAT || 0);
  const monthlyInvoices = Number(analytics?.monthlyInvoices || 0);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border shadow-sm p-16 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="mt-4 text-slate-500">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Welcome Banner */}
      <section className="rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-8 shadow-xl overflow-hidden relative">
        <div className="absolute -right-16 -top-16 w-60 h-60 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10">
          <h1 className="text-4xl font-bold">Welcome back 👋</h1>

          <p className="mt-3 text-blue-100 max-w-2xl">
            Manage invoices, upload documents, analyze results and
            download reports from one dashboard.
          </p>

          <div className="flex flex-wrap gap-3 mt-8">
            <button
              onClick={() => navigate("/dashboard/upload")}
              className="px-6 py-3 rounded-xl bg-white text-blue-700 font-semibold hover:shadow-xl transition"
            >
              Upload Invoice
            </button>

            <button
              onClick={() => navigate("/dashboard/reports")}
              className="px-6 py-3 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition"
            >
              View Reports
            </button>

            <button
              onClick={() => navigate("/dashboard/analytics")}
              className="px-6 py-3 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition"
            >
              Analytics
            </button>
          </div>
        </div>
      </section>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <KpiCard
          title="Total Invoices"
          value={totalInvoices}
          icon={<FileText size={22} />}
          color="blue"
        />
        <KpiCard
          title="Total Revenue"
          value={`AED ${totalRevenue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          icon={<DollarSign size={22} />}
          color="green"
        />
        <KpiCard
          title="Total VAT"
          value={`AED ${totalVAT.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          icon={<Receipt size={22} />}
          color="orange"
        />
        <KpiCard
          title="This Month"
          value={monthlyInvoices}
          icon={<Users size={22} />}
          color="purple"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left column */}
        <div className="xl:col-span-2 space-y-6">

          {/* Recent Invoices */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold text-black">
                Recent Invoices
              </h2>
              <button
                onClick={() => navigate("/dashboard/invoices")}
                className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:underline"
              >
                View all <ArrowRight size={16} />
              </button>
            </div>

            {recentInvoices.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                No invoices yet. Upload your first invoice to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">
                        Invoice #
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">
                        Client
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">
                        Date
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-slate-600">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-slate-600">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className="border-b hover:bg-slate-50 transition"
                      >
                        <td className="px-6 py-4 font-semibold text-black">
                          {invoice.invoiceNo}
                        </td>
                        <td className="px-6 py-4 text-black">
                          {invoice.clientName}
                        </td>
                        <td className="px-6 py-4 text-black">
                          {invoice.invoiceDate
                            ? new Date(
                                invoice.invoiceDate
                              ).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-black">
                          {invoice.currency}{" "}
                          {Number(invoice.totalAmount || 0).toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <button
                              onClick={() =>
                                navigate(`/dashboard/invoices/${invoice.id}`)
                              }
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

          {/* Activity */}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-black mb-6">
              Invoice Activity
            </h2>

            {activity.length === 0 ? (
              <p className="text-slate-500">No recent activity.</p>
            ) : (
              <div className="space-y-4">
                {activity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-black">
                        {item.title}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        {item.client} · {item.amount}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                      <Clock size={14} />
                      {item.date}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Quick Upload */}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-black mb-4">
              Quick Upload
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-black mb-2">
                Select Client
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-black outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name}
                  </option>
                ))}
              </select>
            </div>

            <label className="block border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
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
              <UploadCloud className="mx-auto text-blue-600" size={36} />
              <p className="mt-3 font-medium text-black">
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
              disabled={uploading}
              onClick={handleQuickUpload}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Processing...
                </>
              ) : (
                <>
                  <UploadCloud size={18} />
                  Upload Invoice
                </>
              )}
            </button>

            <button
              onClick={() => navigate("/dashboard/upload")}
              className="mt-3 w-full text-blue-600 text-sm font-medium hover:underline"
            >
              Open full upload page
            </button>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-black mb-4">
              Invoice Stats
            </h2>

            <div className="space-y-4">
              <StatRow
                label="Processed Invoices"
                value={totalInvoices}
              />
              <StatRow
                label="Revenue"
                value={`AED ${totalRevenue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
              />
              <StatRow
                label="VAT Collected"
                value={`AED ${totalVAT.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
              />
              <StatRow
                label="Clients"
                value={clients.length}
              />
              <StatRow
                label="This Month"
                value={monthlyInvoices}
              />
            </div>

            <button
              onClick={() => navigate("/dashboard/analytics")}
              className="mt-6 w-full border border-slate-200 hover:bg-slate-50 text-black py-3 rounded-xl font-medium transition"
            >
              Open Analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-black mt-2">{value}</p>
        </div>
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 text-sm">{label}</span>
      <span className="font-semibold text-black">{value}</span>
    </div>
  );
}
