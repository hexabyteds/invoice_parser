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
} from "lucide-react";
import {
    getInvoices,
    getInvoicesByClient,
    deleteInvoices,
} from "../../services/invoiceApi";
import clientApi from "../../services/clientApi";
import { useNavigate } from "react-router-dom";
import { formatDateDisplay } from "../../utils/formatDate";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import toast from "react-hot-toast";

const ROWS_PER_PAGE = 10;

export default function Invoices() {
    const [invoices, setInvoices] = useState([]);
    const [clients, setClients] = useState([]);
    const [clientId, setClientId] = useState("");
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

    async function loadInvoices(selectedClientId = clientId) {
        try {
            setLoading(true);

            const res = selectedClientId
                ? await getInvoicesByClient(selectedClientId)
                : await getInvoices();

            setInvoices(res.data.invoices || []);
        } catch (err) {
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadClients();
        loadInvoices();
    }, []);

    useEffect(() => {
        loadInvoices(clientId);
        setPage(1);
    }, [clientId]);

    useEffect(() => {
        setPage(1);
    }, [search]);

    const selectedClient = clients.find(
        (c) => String(c.id) === String(clientId)
    );

    const filteredInvoices = useMemo(() => {
        const keyword = search.toLowerCase().trim();

        if (!keyword) return invoices;

        return invoices.filter((invoice) => {
            return (
                invoice.invoiceNo?.toLowerCase().includes(keyword) ||
                invoice.clientName?.toLowerCase().includes(keyword) ||
                invoice.currency?.toLowerCase().includes(keyword)
            );
        });
    }, [search, invoices]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredInvoices.length / ROWS_PER_PAGE)
    );

    const safePage = Math.min(page, totalPages);

    const paginatedInvoices = useMemo(() => {
        const start = (safePage - 1) * ROWS_PER_PAGE;
        return filteredInvoices.slice(start, start + ROWS_PER_PAGE);
    }, [filteredInvoices, safePage]);

    async function confirmDelete() {
        if (!deleteTarget) return;

        try {
            setDeleting(true);
            await deleteInvoices(deleteTarget.id);
            await loadInvoices(clientId);
            toast.success("Invoice deleted.");
        } catch (err) {
            toast.error(
                err.response?.data?.error ||
                    "Could not delete invoice. Please try again."
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
                        Invoices
                    </h1>
                    <p className="text-slate-500 mt-2">
                        {selectedClient
                            ? `Showing invoices for ${selectedClient.company_name}`
                            : "Manage and view all processed invoices."}
                    </p>
                </div>
            </div>

            {/* Search + Client filter */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex flex-col md:flex-row gap-4">

                    <div className="relative flex-1 max-w-md">
                        <Search
                            size={18}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="text"
                            placeholder="Search invoice number, client..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-black"
                        />
                    </div>

                    <div className="md:w-72">
                        <select
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
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
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center">
                        <Loader2
                            size={42}
                            className="animate-spin text-blue-600"
                        />
                        <p className="mt-4 text-slate-500">
                            Loading invoices...
                        </p>
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="py-20 text-center">
                        <FileText
                            size={60}
                            className="mx-auto text-slate-300"
                        />
                        <h3 className="mt-5 text-xl font-semibold text-slate-700">
                            No invoices found
                        </h3>
                        <p className="mt-2 text-slate-500">
                            {clientId
                                ? "No invoices for this client yet."
                                : "Upload your first invoice to get started."}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        Invoice #
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        Supplier
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        Date
                                    </th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-600">
                                        Without VAT
                                    </th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-600">
                                        Amount
                                    </th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-600">
                                        VAT
                                    </th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-600">
                                        VAT Rate
                                    </th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-600">
                                        Currency
                                    </th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-600">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedInvoices.map((invoice) => (
                                    <tr
                                        key={invoice.id}
                                        className="border-b hover:bg-slate-50 transition"
                                    >
                                        <td className="px-6 py-5 font-semibold text-black">
                                            {invoice.invoiceNo}
                                        </td>
                                        <td className="px-6 py-5 text-black">
                                            {invoice.clientName}
                                        </td>
                                        <td className="px-6 py-5 text-black">
                                            {formatDateDisplay(invoice.invoiceDate)}
                                        </td>
                                        <td className="px-6 py-5 text-right text-black">
                                            {Number(
                                                invoice.subtotal || 0
                                            ).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </td>
                                        <td className="px-6 py-5 text-right font-semibold text-black">
                                            {Number(
                                                invoice.totalAmount
                                            ).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </td>
                                        <td className="px-6 py-5 text-right text-black">
                                            {Number(
                                                invoice.vatAmount || 0
                                            ).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </td>
                                        <td className="px-6 py-5 text-center text-black">
                                            {invoice.vatRate ? `${invoice.vatRate}%` : "-"}
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="inline-flex px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                                                {invoice.currency}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() =>
                                                        navigate(
                                                            `/dashboard/invoices/${invoice.id}`
                                                        )
                                                    }
                                                    className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        navigate(
                                                            `/dashboard/invoices/${invoice.id}/edit`
                                                        )
                                                    }
                                                    className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-amber-100 text-amber-600 flex items-center justify-center transition"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setDeleteTarget(invoice)
                                                    }
                                                    className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-red-100 text-red-600 flex items-center justify-center transition"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t bg-slate-50">
                            <p className="text-sm text-slate-600">
                                Showing{" "}
                                {(safePage - 1) * ROWS_PER_PAGE + 1}–
                                {Math.min(
                                    safePage * ROWS_PER_PAGE,
                                    filteredInvoices.length
                                )}{" "}
                                of {filteredInvoices.length} invoices
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
                title="Delete this invoice?"
                message={
                    deleteTarget
                        ? `Invoice ${deleteTarget.invoiceNo || ""} will be permanently deleted. This cannot be undone.`
                        : ""
                }
                loading={deleting}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTarget(null)}
            />

        </div>
    );
}
