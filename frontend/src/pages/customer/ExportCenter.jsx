import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileType,
  Database,
  CalendarRange,
  Users,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import clientApi from "../../services/clientApi";
import { exportInvoices } from "../../services/reportApi";

const FORMATS = [
  {
    value: "excel",
    label: "Excel (.xlsx)",
    description: "Workbook with invoice sheets",
    icon: FileSpreadsheet,
    ext: "xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  {
    value: "csv",
    label: "CSV (.csv)",
    description: "Universal spreadsheet format",
    icon: FileText,
    ext: "csv",
    mime: "text/csv",
  },
  {
    value: "zoho",
    label: "Zoho Books Bills (.xlsx)",
    description: "Matches Zoho Bills import template",
    icon: Database,
    ext: "xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  {
    value: "quickbooks",
    label: "QuickBooks (.csv)",
    description: "Ready for QuickBooks Online import",
    icon: Database,
    ext: "csv",
    mime: "text/csv",
  },
  {
    value: "pdf",
    label: "PDF (.pdf)",
    description: "Printable invoice summary PDF",
    icon: FileType,
    ext: "pdf",
    mime: "application/pdf",
  },
  {
    value: "html",
    label: "HTML Report",
    description: "Printable HTML invoice report",
    icon: FileText,
    ext: "html",
    mime: "text/html",
  },
];

export default function ExportCenter() {
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    clientId: "",
    format: "excel",
    from: "",
    to: "",
  });

  useEffect(() => {
    async function loadClients() {
      try {
        const res = await clientApi.getAll();
        setClients(res.clients || []);
      } catch (err) {
      
      } finally {
        setLoadingClients(false);
      }
    }

    loadClients();
  }, []);

  const selectedFormat = useMemo(
    () => FORMATS.find((f) => f.value === form.format) || FORMATS[0],
    [form.format]
  );

  const selectedClient = useMemo(
    () => clients.find((c) => String(c.id) === String(form.clientId)),
    [clients, form.clientId]
  );

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
    setSuccess("");
  }

  function setQuickRange(days) {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);

    setForm((prev) => ({
      ...prev,
      from: toInputDate(from),
      to: toInputDate(to),
    }));
    setError("");
    setSuccess("");
  }

  async function handleExport(e) {
    e.preventDefault();

    if (form.from && form.to && form.from > form.to) {
      setError("From date cannot be after To date.");
      return;
    }

    try {
      setExporting(true);
      setError("");
      setSuccess("");

      const res = await exportInvoices({
        format: form.format,
        clientId: form.clientId || undefined,
        from: form.from || undefined,
        to: form.to || undefined,
      });

      const blob = new Blob([res.data], {
        type: selectedFormat.mime,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const clientPart = selectedClient
        ? selectedClient.company_name.replace(/\s+/g, "_")
        : "all_clients";

      const formatTag =
        form.format === "csv" ||
        form.format === "excel" ||
        form.format === "pdf" ||
        form.format === "zoho"
          ? form.format === "zoho"
            ? "_zoho_bills"
            : ""
          : `_${form.format}`;

      link.href = url;
      link.download = `invoices_${clientPart}${formatTag}_${form.from || "start"}_${form.to || "end"}.${selectedFormat.ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSuccess(
        `Exported ${selectedFormat.label} successfully.`
      );
    } catch (err) {
     
      setError(
        err.response?.data?.error ||
          "Unable to export invoices. Please try again."
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl font-bold text-slate-800">
          Export Center
        </h1>
        <p className="text-slate-500 mt-2">
          Choose a client, format, and date range — then download your invoices.
        </p>
      </div>

      <form
        onSubmit={handleExport}
        className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]"
      >

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">

          <div>
            <h2 className="text-xl font-semibold text-slate-800">
              Export Filters
            </h2>
            <p className="text-slate-500 mt-1 text-sm">
              Only invoices matching these filters will be included.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <Users size={16} className="text-blue-600" />
                Client
              </label>
              <select
                value={form.clientId}
                onChange={(e) => update("clientId", e.target.value)}
                disabled={loadingClients}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              >
                <option value="">All Clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <FileSpreadsheet size={16} className="text-blue-600" />
                Format
              </label>
              <select
                value={form.format}
                onChange={(e) => update("format", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              >
                {FORMATS.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <CalendarRange size={16} className="text-blue-600" />
                From
              </label>
              <input
                type="date"
                value={form.from}
                onChange={(e) => update("from", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <CalendarRange size={16} className="text-blue-600" />
                To
              </label>
              <input
                type="date"
                value={form.to}
                onChange={(e) => update("to", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>

          </div>

          <div className="flex flex-wrap gap-2">
            <QuickButton label="Last 7 days" onClick={() => setQuickRange(7)} />
            <QuickButton label="Last 30 days" onClick={() => setQuickRange(30)} />
            <QuickButton label="Last 90 days" onClick={() => setQuickRange(90)} />
            <QuickButton
              label="Clear dates"
              onClick={() => {
                setForm((prev) => ({ ...prev, from: "", to: "" }));
                setError("");
                setSuccess("");
              }}
            />
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-600">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <p>{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={exporting}
            className="inline-flex w-full md:w-auto items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
          >
            {exporting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Download size={18} />
            )}
            {exporting ? "Exporting..." : "Export Data"}
          </button>

        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 h-fit space-y-6">

          <div>
            <h2 className="text-xl font-semibold text-slate-800">
              Export Summary
            </h2>
            <p className="text-slate-500 mt-1 text-sm">
              Review your selection before downloading.
            </p>
          </div>

          <div className="space-y-4">
            <SummaryRow
              label="Client"
              value={selectedClient?.company_name || "All Clients"}
            />
            <SummaryRow
              label="Format"
              value={selectedFormat.label}
            />
            <SummaryRow
              label="Date Range"
              value={
                form.from || form.to
                  ? `${form.from || "Any"} → ${form.to || "Any"}`
                  : "All dates"
              }
            />
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <selectedFormat.icon
                size={22}
                className="text-blue-600 mt-0.5"
              />
              <div>
                <p className="font-semibold text-slate-800">
                  {selectedFormat.label}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedFormat.description}
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Leave dates empty to export every invoice for the selected client.
            Date filtering uses each invoice&apos;s invoice date.
          </p>

        </div>

      </form>

    </div>
  );
}

function QuickButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition"
    >
      {label}
    </button>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-slate-500 text-sm">{label}</span>
      <span className="font-semibold text-slate-800 text-right">
        {value}
      </span>
    </div>
  );
}

function toInputDate(date) {
  return date.toISOString().split("T")[0];
}
