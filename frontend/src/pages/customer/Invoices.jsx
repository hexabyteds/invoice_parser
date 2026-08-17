import { useEffect, useMemo, useState } from "react";
import {
    Search,
    Eye,
    Pencil,
    Trash2,
    FileText,
    Loader2,
    ChevronLeft,
    ChevronRight,
    CalendarRange,
} from "lucide-react";
import { getDocuments } from "../../services/documentsApi";
import { deleteInvoices } from "../../services/invoiceApi";
import { deleteBankStatement } from "../../services/bankStatementApi";
import clientApi from "../../services/clientApi";
import { useNavigate } from "react-router-dom";
import { formatDateDisplay } from "../../utils/formatDate";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import toast from "react-hot-toast";
import { DOCUMENT_TYPES, documentTypeLabel, documentTypeBadgeClass } from "../../utils/documentTypes";
import { isClientActive } from "../../utils/clientStatus";

const ROWS_PER_PAGE = 10;
const BANK_STATEMENT = "bank_statement";

function toInputDate(date) {
    return date.toISOString().split("T")[0];
}

export default function Invoices() {
    const [documents, setDocuments] = useState([]);
    const [clients, setClients] = useState([]);
    const [clientId, setClientId] = useState("");
    const [documentType, setDocumentType] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [dateError, setDateError] = useState("");
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const navigate = useNavigate();

    async function loadClients() {
        try {
            const res = await clientApi.getAll();
            setClients(res.clients || []);
        } catch (err) {
        }
    }

    async function loadDocuments(
        selectedClientId = clientId,
        selectedDocumentType = documentType,
        selectedFrom = fromDate,
        selectedTo = toDate
    ) {
        if (selectedFrom && selectedTo && selectedFrom > selectedTo) {
            setDateError("From date cannot be after To date.");
            return;
        }

        setDateError("");

        try {
            setLoading(true);

            const res = await getDocuments({
                clientId: selectedClientId || undefined,
                documentType: selectedDocumentType || undefined,
                from: selectedFrom || undefined,
                to: selectedTo || undefined,
            });

            setDocuments(res.data.documents || []);
        } catch (err) {
        } finally {
            setLoading(false);
        }
    }

    function setQuickRange(days) {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - days);

        setFromDate(toInputDate(from));
        setToDate(toInputDate(to));
    }

    function clearDateRange() {
        setFromDate("");
        setToDate("");
        setDateError("");
    }

    useEffect(() => {
        loadClients();
        loadDocuments();
    }, []);

    useEffect(() => {
        loadDocuments(clientId, documentType, fromDate, toDate);
        setPage(1);
    }, [clientId, documentType, fromDate, toDate]);

    useEffect(() => {
        setPage(1);
    }, [search]);

    const activeClients = useMemo(
        () => clients.filter((c) => isClientActive(c.status)),
        [clients]
    );

    const inactiveClientIds = useMemo(
        () =>
            new Set(
                clients
                    .filter((c) => !isClientActive(c.status))
                    .map((c) => c.id)
            ),
        [clients]
    );

    const selectedClient = clients.find(
        (c) => String(c.id) === String(clientId)
    );

    const filteredDocuments = useMemo(() => {
        const keyword = search.toLowerCase().trim();

        const visibleDocuments = documents.filter(
            (doc) => !inactiveClientIds.has(doc.clientId)
        );

        if (!keyword) return visibleDocuments;

        return visibleDocuments.filter((doc) => {
            return (
                doc.number?.toLowerCase().includes(keyword) ||
                doc.fileName?.toLowerCase().includes(keyword) ||
                doc.partyOrBank?.toLowerCase().includes(keyword) ||
                doc.currency?.toLowerCase().includes(keyword)
            );
        });
    }, [search, documents, inactiveClientIds]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredDocuments.length / ROWS_PER_PAGE)
    );

    const safePage = Math.min(page, totalPages);

    const paginatedDocuments = useMemo(() => {
        const start = (safePage - 1) * ROWS_PER_PAGE;
        return filteredDocuments.slice(start, start + ROWS_PER_PAGE);
    }, [filteredDocuments, safePage]);

    function viewDocument(doc) {
        if (doc.documentType === BANK_STATEMENT) {
            navigate(`/dashboard/bank-statements/${doc.id}`);
        } else {
            const invoiceIds = filteredDocuments
                .filter((d) => d.documentType !== BANK_STATEMENT)
                .map((d) => d.id);

            navigate(`/dashboard/invoices/${doc.id}`, {
                state: { invoiceIds },
            });
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;

        try {
            setDeleting(true);

            if (deleteTarget.documentType === BANK_STATEMENT) {
                await deleteBankStatement(deleteTarget.id);
            } else {
                await deleteInvoices(deleteTarget.id);
            }

            await loadDocuments(clientId);
            toast.success("Document deleted.");
        } catch (err) {
            toast.error(
                err.response?.data?.error ||
                    "Could not delete document. Please try again."
            );
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    }

    return (
        <div className="space-y-8">

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">
                        Documents
                    </h1>
                    <p className="text-slate-500 mt-2">
                        {selectedClient
                            ? `Showing documents for ${selectedClient.company_name}`
                            : "Manage and view all processed documents."}
                    </p>
                </div>
            </div>

            {/* Search + Client filter */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex flex-col md:flex-row gap-4">

                    <div className="relative flex-1 max-w-md">
                        <Search
                            size={18}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="text"
                            placeholder="Search document, client, bank..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-slate-900"
                        />
                    </div>

                    <div className="md:w-72">
                        <select
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-slate-900"
                        >
                            <option value="">All Clients</option>
                            {activeClients.map((client) => (
                                <option key={client.id} value={client.id}>
                                    {client.company_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="md:w-72">
                        <select
                            value={documentType}
                            onChange={(e) => setDocumentType(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-slate-900"
                        >
                            <option value="">All Types</option>
                            {DOCUMENT_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </div>

                </div>

                <div className="flex flex-col md:flex-row md:items-end gap-4 pt-4 border-t border-slate-100">
                    <div className="md:w-56">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                            <CalendarRange size={16} className="text-indigo-600" />
                            From
                        </label>
                        <input
                            type="date"
                            value={fromDate}
                            max={toDate || undefined}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-slate-900"
                        />
                    </div>

                    <div className="md:w-56">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                            <CalendarRange size={16} className="text-indigo-600" />
                            To
                        </label>
                        <input
                            type="date"
                            value={toDate}
                            min={fromDate || undefined}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-slate-900"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <QuickButton label="Last 7 days" onClick={() => setQuickRange(7)} />
                        <QuickButton label="Last 30 days" onClick={() => setQuickRange(30)} />
                        <QuickButton label="Last 90 days" onClick={() => setQuickRange(90)} />
                        <QuickButton label="Clear dates" onClick={clearDateRange} />
                    </div>
                </div>

                {dateError && (
                    <p className="text-sm text-red-600">{dateError}</p>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center">
                        <Loader2
                            size={42}
                            className="animate-spin text-indigo-600"
                        />
                        <p className="mt-4 text-slate-500">
                            Loading documents...
                        </p>
                    </div>
                ) : filteredDocuments.length === 0 ? (
                    <div className="py-20 text-center">
                        <FileText
                            size={60}
                            className="mx-auto text-slate-300"
                        />
                        <h3 className="mt-5 text-xl font-semibold text-slate-700">
                            No documents found
                        </h3>
                        <p className="mt-2 text-slate-500">
                            {clientId
                                ? "No documents for this client yet."
                                : "Upload your first document to get started."}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                       Sr. #
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        Document
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        Type
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        Party / Bank
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        Date
                                    </th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-600">
                                        Amount
                                    </th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-600">
                                        Currency
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        Uploaded
                                    </th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-600">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedDocuments.map((doc, index) => {
                                    const isBankStatement = doc.documentType === BANK_STATEMENT;

                                    return (
                                        <tr
                                            key={`${doc.documentType}-${doc.id}`}
                                            className="border-b hover:bg-slate-50 transition"
                                        >
                                            <td className="px-6 py-5 text-slate-500">
                                                {(safePage - 1) * ROWS_PER_PAGE + index + 1}
                                            </td>
                                            <td className="px-6 py-5 font-semibold text-slate-900">
                                                {doc.number || doc.fileName || "-"}
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${documentTypeBadgeClass(doc.documentType)}`}>
                                                    {documentTypeLabel(doc.documentType)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-slate-900">
                                                {doc.partyOrBank || "-"}
                                            </td>
                                            <td className="px-6 py-5 text-slate-900">
                                                {formatDateDisplay(doc.date)}
                                            </td>
                                            <td className="px-6 py-5 text-right font-semibold text-slate-900">
                                                {doc.amount === null || doc.amount === undefined
                                                    ? "-"
                                                    : Number(doc.amount).toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                    })}
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <span className="inline-flex px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-xs font-semibold">
                                                    {doc.currency || "-"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-slate-900">
                                                {formatDateDisplay(doc.uploadedAt)}
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => viewDocument(doc)}
                                                        className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    {!isBankStatement && (
                                                        <button
                                                            onClick={() =>
                                                                navigate(
                                                                    `/dashboard/invoices/${doc.id}/edit`
                                                                )
                                                            }
                                                            className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-amber-100 text-amber-600 flex items-center justify-center transition"
                                                        >
                                                            <Pencil size={18} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() =>
                                                            setDeleteTarget(doc)
                                                        }
                                                        className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-red-100 text-red-600 flex items-center justify-center transition"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t bg-slate-50">
                            <p className="text-sm text-slate-600">
                                Showing{" "}
                                {(safePage - 1) * ROWS_PER_PAGE + 1}–
                                {Math.min(
                                    safePage * ROWS_PER_PAGE,
                                    filteredDocuments.length
                                )}{" "}
                                of {filteredDocuments.length} documents
                            </p>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setPage((p) => Math.max(1, p - 1))
                                    }
                                    disabled={safePage <= 1}
                                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition"
                                >
                                    <ChevronLeft size={18} />
                                    Previous
                                </button>

                                <span className="text-sm text-slate-600 px-2">
                                    Page {safePage} of {totalPages}
                                </span>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setPage((p) =>
                                            Math.min(totalPages, p + 1)
                                        )
                                    }
                                    disabled={safePage >= totalPages}
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

            <ConfirmDialog
                open={Boolean(deleteTarget)}
                title="Delete this document?"
                message={
                    deleteTarget
                        ? `${deleteTarget.number || deleteTarget.fileName || "This document"} will be permanently deleted. This cannot be undone.`
                        : ""
                }
                loading={deleting}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTarget(null)}
            />

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
