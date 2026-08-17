import { useEffect, useMemo, useState } from "react";
import {
    Search,
    Loader2,
    ChevronLeft,
    ChevronRight,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
} from "lucide-react";
import { getBankStatementTransactions } from "../../services/bankStatementApi";
import { formatDateDisplay } from "../../utils/formatDate";

const PAGE_SIZE = 25;

const SORT_COLUMNS = [
    { key: "transaction_date", label: "Date" },
    { key: "credit", label: "Credit", align: "right" },
    { key: "debit", label: "Debit", align: "right" },
    { key: "available_balance", label: "Balance", align: "right" },
];

function money(value) {
    if (value === null || value === undefined) return "-";
    return Number(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function BankStatementTransactionsTable({ statementId }) {
    const [transactions, setTransactions] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: PAGE_SIZE, hasMore: false });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [creditDebit, setCreditDebit] = useState("");
    const [sortBy, setSortBy] = useState("id");
    const [sortDir, setSortDir] = useState("asc");

    // Debounce the free-text search so we don't fire a request per keystroke.
    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        setPage(1);
    }, [search, fromDate, toDate, creditDebit, sortBy, sortDir]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                setError("");

                const params = {
                    page,
                    pageSize: PAGE_SIZE,
                    sortBy,
                    sortDir,
                    ...(search ? { search } : {}),
                    ...(fromDate ? { from: fromDate } : {}),
                    ...(toDate ? { to: toDate } : {}),
                    ...(creditDebit === "credit" ? { hasCredit: true } : {}),
                    ...(creditDebit === "debit" ? { hasDebit: true } : {}),
                };

                const res = await getBankStatementTransactions(statementId, params);

                if (cancelled) return;

                setTransactions(res.data.transactions || []);
                setPagination(res.data.pagination || { total: 0, page, pageSize: PAGE_SIZE, hasMore: false });
            } catch (err) {
                if (cancelled) return;
                setError(err.response?.data?.error || "Unable to load transactions.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [statementId, page, sortBy, sortDir, search, fromDate, toDate, creditDebit]);

    const totalPages = Math.max(1, Math.ceil(pagination.total / PAGE_SIZE));

    function toggleSort(column) {
        if (sortBy === column) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortBy(column);
            setSortDir("asc");
        }
    }

    function sortIcon(column) {
        if (sortBy !== column) return <ArrowUpDown size={14} className="text-slate-400" />;
        return sortDir === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
    }

    const rangeLabel = useMemo(() => {
        if (pagination.total === 0) return "0 transactions";
        const start = (page - 1) * PAGE_SIZE + 1;
        const end = Math.min(page * PAGE_SIZE, pagination.total);
        return `Showing ${start}-${end} of ${pagination.total} transactions`;
    }, [page, pagination.total]);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            <div className="border-b bg-slate-50 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-black">Transactions</h2>

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search description..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-black outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <select
                        value={creditDebit}
                        onChange={(e) => setCreditDebit(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">Credit & Debit</option>
                        <option value="credit">Credit only</option>
                        <option value="debit">Debit only</option>
                    </select>

                    <input
                        type="date"
                        value={fromDate}
                        max={toDate || undefined}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    <input
                        type="date"
                        value={toDate}
                        min={fromDate || undefined}
                        onChange={(e) => setToDate(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            {error && (
                <div className="px-6 py-4 text-sm text-red-600 bg-red-50">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="py-16 flex flex-col items-center justify-center">
                    <Loader2 size={36} className="animate-spin text-indigo-600" />
                    <p className="mt-3 text-slate-500">Loading transactions...</p>
                </div>
            ) : transactions.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                    No transactions match the current filters.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-slate-50 border-b">
                            <tr>
                                <th
                                    onClick={() => toggleSort("transaction_date")}
                                    className="px-6 py-3 text-left text-sm font-semibold text-slate-600 cursor-pointer select-none"
                                >
                                    <span className="inline-flex items-center gap-1">Date {sortIcon("transaction_date")}</span>
                                </th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">
                                    Description
                                </th>
                                <th
                                    onClick={() => toggleSort("credit")}
                                    className="px-6 py-3 text-right text-sm font-semibold text-slate-600 cursor-pointer select-none"
                                >
                                    <span className="inline-flex items-center gap-1 justify-end">Credit {sortIcon("credit")}</span>
                                </th>
                                <th
                                    onClick={() => toggleSort("debit")}
                                    className="px-6 py-3 text-right text-sm font-semibold text-slate-600 cursor-pointer select-none"
                                >
                                    <span className="inline-flex items-center gap-1 justify-end">Debit {sortIcon("debit")}</span>
                                </th>
                                <th
                                    onClick={() => toggleSort("available_balance")}
                                    className="px-6 py-3 text-right text-sm font-semibold text-slate-600 cursor-pointer select-none"
                                >
                                    <span className="inline-flex items-center gap-1 justify-end">Balance {sortIcon("available_balance")}</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((tx) => (
                                <tr key={tx.id} className="border-b hover:bg-slate-50 transition">
                                    <td className="px-6 py-4 text-black whitespace-nowrap align-top">
                                        {formatDateDisplay(tx.transactionDate)}
                                    </td>
                                    <td className="px-6 py-4 text-black align-top">
                                        {tx.description || "-"}
                                        {tx.referenceNo && (
                                            <span className="block text-xs text-slate-400 mt-1">
                                                Ref: {tx.referenceNo}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right align-top text-emerald-600 font-medium">
                                        {Number(tx.credit) > 0 ? money(tx.credit) : "-"}
                                    </td>
                                    <td className="px-6 py-4 text-right align-top text-red-600 font-medium">
                                        {Number(tx.debit) > 0 ? money(tx.debit) : "-"}
                                    </td>
                                    <td className="px-6 py-4 text-right align-top font-semibold text-black">
                                        {money(tx.availableBalance)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t bg-slate-50">
                        <p className="text-sm text-slate-600">{rangeLabel}</p>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition"
                            >
                                <ChevronLeft size={18} />
                                Previous
                            </button>

                            <span className="text-sm text-slate-600 px-2">
                                Page {page} of {totalPages}
                            </span>

                            <button
                                type="button"
                                onClick={() => setPage((p) => (pagination.hasMore ? p + 1 : p))}
                                disabled={!pagination.hasMore}
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition"
                            >
                                Next
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
