import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  UploadCloud,
  Download,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";

const ROWS_PER_PAGE = 10;

const STATUS_FILTERS = ["All", "Healthy", "Attention", "Critical"];

function healthStatus(row) {
  if (row.uploaded === 0) return "No data";
  if (row.failed > 0 && row.failed >= row.processed) return "Critical";
  if (row.failed > 0 || row.accuracy < 80) return "Attention";
  return "Healthy";
}

const STATUS_BADGE = {
  Healthy: "bg-green-100 text-green-700",
  Attention: "bg-amber-100 text-amber-700",
  Critical: "bg-red-100 text-red-700",
  "No data": "bg-slate-100 text-slate-500",
};

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
}

function exportCsv(rows) {
  const header = [
    "Client",
    "Invoices Uploaded",
    "Processed",
    "Failed",
    "Accuracy %",
    "Last Active",
    "Status",
  ];

  const lines = rows.map((row) =>
    [
      row.companyName,
      row.uploaded,
      row.processed,
      row.failed,
      row.accuracy,
      formatDate(row.lastActive),
      healthStatus(row),
    ]
      .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
      .join(",")
  );

  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `client-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ClientAnalyticsTable({ clients = [] }) {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortKey, setSortKey] = useState("uploaded");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  function toggleSort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  }

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return clients.filter((row) => {
      const matchesSearch =
        !keyword || row.companyName?.toLowerCase().includes(keyword);
      const matchesStatus =
        statusFilter === "All" || healthStatus(row) === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [clients, search, statusFilter]);

  const sorted = useMemo(() => {
    const rows = [...filtered];

    rows.sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];

      if (sortKey === "companyName") {
        av = av?.toLowerCase() || "";
        bv = bv?.toLowerCase() || "";
      } else if (sortKey === "lastActive") {
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      } else {
        av = Number(av) || 0;
        bv = Number(bv) || 0;
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);

  const paginated = useMemo(() => {
    const start = (safePage - 1) * ROWS_PER_PAGE;
    return sorted.slice(start, start + ROWS_PER_PAGE);
  }, [sorted, safePage]);

  function SortHeader({ label, sortKeyName, align = "left" }) {
    const active = sortKey === sortKeyName;
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;

    return (
      <th
        className={`px-6 py-3 text-sm font-semibold text-slate-600 cursor-pointer select-none ${
          align === "right" ? "text-right" : "text-left"
        }`}
        onClick={() => toggleSort(sortKeyName)}
      >
        <span
          className={`inline-flex items-center gap-1 ${
            align === "right" ? "flex-row-reverse" : ""
          }`}
        >
          {label}
          <Icon size={13} className={active ? "text-indigo-600" : "text-slate-300"} />
        </span>
      </th>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className="p-6 border-b flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Client Analytics</h2>
          <p className="text-sm text-slate-500 mt-1">
            Upload volume, extraction quality, and activity per client.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search client..."
              className="pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-56"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <button
            onClick={() => exportCsv(sorted)}
            disabled={sorted.length === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-900 transition disabled:opacity-50"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="p-12 text-center text-slate-500">
          <Users size={40} className="mx-auto text-slate-300" />
          <p className="mt-3">No clients yet. Add a client to see analytics here.</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="p-12 text-center text-slate-500">
          No clients match your search/filter.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <SortHeader label="Client" sortKeyName="companyName" />
                  <SortHeader label="Uploaded" sortKeyName="uploaded" align="right" />
                  <SortHeader label="Processed" sortKeyName="processed" align="right" />
                  <SortHeader label="Failed" sortKeyName="failed" align="right" />
                  <SortHeader label="Accuracy" sortKeyName="accuracy" align="right" />
                  <SortHeader label="Last Active" sortKeyName="lastActive" />
                  <th className="px-6 py-3 text-sm font-semibold text-slate-600 text-center">
                    Status
                  </th>
                  <th className="px-6 py-3 text-sm font-semibold text-slate-600 text-center">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {paginated.map((row) => {
                  const status = healthStatus(row);

                  return (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/dashboard/clients/${row.id}`)}
                      className="border-b hover:bg-slate-50 transition cursor-pointer"
                    >
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {row.companyName}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-900">{row.uploaded}</td>
                      <td className="px-6 py-4 text-right text-slate-900">{row.processed}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={row.failed > 0 ? "text-red-600 font-semibold" : "text-slate-900"}>
                          {row.failed}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                row.accuracy >= 80
                                  ? "bg-emerald-500"
                                  : row.accuracy >= 50
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                              }`}
                              style={{ width: `${Math.max(0, Math.min(100, row.accuracy))}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-900 w-9 text-right">
                            {row.accuracy}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-sm">
                        {formatDate(row.lastActive)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[status]}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/dashboard/clients/${row.id}`);
                            }}
                            className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition"
                            title="View client"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/dashboard/upload/${row.id}`);
                            }}
                            className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-green-100 text-green-600 flex items-center justify-center transition"
                            title="Upload invoice"
                          >
                            <UploadCloud size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t bg-slate-50">
            <p className="text-sm text-slate-600">
              Showing {(safePage - 1) * ROWS_PER_PAGE + 1}–
              {Math.min(safePage * ROWS_PER_PAGE, sorted.length)} of {sorted.length} clients
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <ChevronLeft size={18} />
                Previous
              </button>

              <span className="text-sm text-slate-400 px-2">
                Page {safePage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
