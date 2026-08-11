import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import clientApi from "../../services/clientApi.js";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import {
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Eye,
    FileText,
    Loader2,
    Pencil,
    Power,
    PowerOff,
    Trash2,
} from "lucide-react";

import {
    deleteInvoices,
    getInvoicesByClient,
  } from "../../services/invoiceApi";
import { formatDateDisplay } from "../../utils/formatDate";
import { documentTypeLabel, documentTypeBadgeClass } from "../../utils/documentTypes";
import { isClientActive, clientStatusLabel, clientStatusBadgeClass } from "../../utils/clientStatus";

const ROWS_PER_PAGE = 10;

export default function ClientDetails() {

    const { id } = useParams();

    const [client, setClient] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteInvoiceTarget, setDeleteInvoiceTarget] = useState(null);
    const [deletingInvoice, setDeletingInvoice] = useState(false);
    const [togglingStatus, setTogglingStatus] = useState(false);
    const navigate = useNavigate();

    async function handleDelete() {
        try {
            setDeleting(true);
            await clientApi.delete(id);
            toast.success("Client deleted.");
            navigate("/dashboard/clients");
        } catch (err) {
            toast.error(
                err.response?.data?.error ||
                    "Could not delete client. Please try again."
            );
        } finally {
            setDeleting(false);
            setConfirmOpen(false);
        }
    }

    async function handleToggleStatus() {
        if (!client) return;

        const nextStatus = isClientActive(client.status) ? "INACTIVE" : "ACTIVE";

        try {
            setTogglingStatus(true);
            const res = await clientApi.updateStatus(id, nextStatus);
            setClient(res.client);
            toast.success(
                nextStatus === "ACTIVE" ? "Client reactivated." : "Client deactivated."
            );
        } catch (err) {
            toast.error(
                err.response?.data?.error ||
                    "Could not update client status. Please try again."
            );
        } finally {
            setTogglingStatus(false);
        }
    }

    async function confirmDeleteInvoice() {
        if (!deleteInvoiceTarget) return;

        try {
            setDeletingInvoice(true);
            await deleteInvoices(deleteInvoiceTarget.id);
            await load();
            toast.success("Invoice deleted.");
        } catch (err) {
            toast.error(
                err.response?.data?.error ||
                    "Could not delete invoice. Please try again."
            );
        } finally {
            setDeletingInvoice(false);
            setDeleteInvoiceTarget(null);
        }
    }

    useEffect(() => {
        setPage(1);
        load();
    }, [id]);

    async function load() {

        setLoading(true);
        setError(null);

        try {

            const clientRes = await clientApi.get(id);
            const invoiceRes = await getInvoicesByClient(id);

            setClient(clientRes.client);
            setInvoices(invoiceRes?.data?.invoices || []);

        } catch (err) {

            setClient(null);
            setInvoices([]);
            setError(
                err.response?.data?.error ||
                    "Could not load this client. Please try again."
            );

        } finally {

            setLoading(false);

        }

    }

    const totalPages = Math.max(1, Math.ceil(invoices.length / ROWS_PER_PAGE));
    const safePage = Math.min(page, totalPages);

    const paginatedInvoices = useMemo(() => {
        const start = (safePage - 1) * ROWS_PER_PAGE;
        return invoices.slice(start, start + ROWS_PER_PAGE);
    }, [invoices, safePage]);

    // Client-wise Excel: /api/download-excel?client_id={id}
    async function handleDownloadExcel() {

        try {

            setDownloading(true);

            const blob = await clientApi.downloadExcel(id);

            // Backend returned an error as JSON
            if (blob.type?.includes("application/json")) {

                const text = await blob.text();
                const json = JSON.parse(text);

                throw new Error(json.error);

            }

            const url = window.URL.createObjectURL(blob);

            const link = document.createElement("a");

            link.href = url;
            link.download = `${client.company_name}-invoices.xlsx`;

            document.body.appendChild(link);

            link.click();

            link.remove();

            window.URL.revokeObjectURL(url);

        } catch (err) {


            alert(err.message);

        } finally {

            setDownloading(false);

        }

    }
    if (loading) {
        return (
            <div className="py-20 flex flex-col items-center justify-center">
                <Loader2 size={36} className="animate-spin text-indigo-600" />
                <p className="mt-4 text-slate-500">
                    Loading client...
                </p>
            </div>
        );
    }

    if (error || !client) {
        return (
            <div className="py-20 flex flex-col items-center justify-center text-center">
                <AlertCircle size={48} className="text-red-500" />
                <h3 className="mt-4 text-xl font-semibold text-slate-900">
                    Couldn't load client
                </h3>
                <p className="mt-2 text-slate-500 max-w-sm">
                    {error || "This client no longer exists."}
                </p>
                <div className="mt-5 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={load}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all"
                    >
                        Retry
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/dashboard/clients")}
                        className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
                    >
                        Back to clients
                    </button>
                </div>
            </div>
        );
    }

    return (

        <div className="space-y-8">

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">

                <div className="flex items-start justify-between gap-4">

                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-4xl font-bold text-slate-900">

                                {client.company_name}

                            </h1>

                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${clientStatusBadgeClass(client.status)}`}>
                                {clientStatusLabel(client.status)}
                            </span>
                        </div>

                        <p className="text-slate-500 mt-3">

                            {client.contact_person}

                        </p>
                    </div>

                    <div className="flex items-center gap-3">

                        <button
                            type="button"
                            onClick={handleToggleStatus}
                            disabled={togglingStatus}
                            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border transition disabled:opacity-60 ${
                                isClientActive(client.status)
                                    ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                        >
                            {isClientActive(client.status) ? (
                                <PowerOff size={16} />
                            ) : (
                                <Power size={16} />
                            )}
                            {togglingStatus
                                ? "Updating..."
                                : isClientActive(client.status)
                                    ? "Deactivate"
                                    : "Activate"}
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                navigate(`/dashboard/clients/${id}/edit`)
                            }
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
                        >
                            <Pencil size={16} />
                            Edit
                        </button>

                        <button
                            type="button"
                            onClick={() => setConfirmOpen(true)}
                            disabled={deleting}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-60"
                        >
                            <Trash2 size={16} />
                            {deleting ? "Deleting..." : "Delete"}
                        </button>

                    </div>

                </div>

                <div className="grid grid-cols-4 gap-6 mt-8">

                    <div>

                        <h3 className="text-slate-500 text-sm">

                            Email

                        </h3>

                        <p className="text-slate-900 mt-1">

                            {client.email}

                        </p>

                    </div>

                    <div>

                        <h3 className="text-slate-500 text-sm">

                            Phone

                        </h3>

                        <p className="text-slate-900 mt-1">

                            {client.phone}

                        </p>

                    </div>

                    <div>

                        <h3 className="text-slate-500 text-sm">

                            Country

                        </h3>

                        <p className="text-slate-900 mt-1">

                            {client.country}

                        </p>

                    </div>

                    <div>

                        <h3 className="text-slate-500 text-sm">

                            TRN

                        </h3>

                        <p className="text-slate-900 mt-1">

                            {client.trn}

                        </p>

                    </div>

                </div>

            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                <div className="px-6 py-5 border-b">
                    <h2 className="text-xl font-semibold text-slate-900">
                        Client Invoices
                    </h2>
                </div>

                {invoices.length === 0 ? (
                    <div className="py-20 text-center">
                        <FileText
                            size={60}
                            className="mx-auto text-slate-300"
                        />
                        <h3 className="mt-5 text-xl font-semibold text-slate-700">
                            No documents found
                        </h3>
                        <p className="mt-2 text-slate-500">
                            No documents for this client yet.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        {/* <table className="min-w-full">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        #
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        Invoice #
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        Supplier
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        Type
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

                                {paginatedInvoices.map((invoice, index) => (

                                        <tr
                                            key={invoice.id}
                                            className="border-b hover:bg-slate-50 transition"
                                        >

                                            <td className="px-6 py-5 text-slate-500">
                                                {(safePage - 1) * ROWS_PER_PAGE + index + 1}
                                            </td>

                                            <td className="px-6 py-5 font-semibold text-slate-900">
                                                {invoice.invoiceNo}
                                            </td>

                                            <td className="px-6 py-5 text-slate-900">
                                                {invoice.clientName}
                                            </td>

                                            <td className="px-6 py-5">
                                                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${documentTypeBadgeClass(invoice.documentType)}`}>
                                                    {documentTypeLabel(invoice.documentType)}
                                                </span>
                                            </td>

                                            <td className="px-6 py-5 text-slate-900">
                                                {formatDateDisplay(invoice.invoiceDate)}
                                            </td>

                                            <td className="px-6 py-5 text-right text-slate-900">
                                                {Number(
                                                    invoice.subtotal || 0
                                                ).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </td>

                                            <td className="px-6 py-5 text-right font-semibold text-slate-900">
                                                {Number(
                                                    invoice.totalAmount
                                                ).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </td>

                                            <td className="px-6 py-5 text-right text-slate-900">
                                                {Number(
                                                    invoice.vatAmount || 0
                                                ).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </td>

                                            <td className="px-6 py-5 text-center text-slate-900">
                                                {invoice.vatRate ? `${invoice.vatRate}%` : "-"}
                                            </td>

                                            <td className="px-6 py-5 text-center">
                                                <span className="inline-flex px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 text-xs font-semibold">
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
                                                        className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition"
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
                                                            setDeleteInvoiceTarget(invoice)
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

                        </table> */}
                        <table className="min-w-full">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                       Sr. #
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        Document No.
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        Document Date
                                    </th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-600">
                                       Amount Excl. VAT
                                    </th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-600">
                                        Amount Incl. VAT
                                    </th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-600">
                                        VAT Amount
                                    </th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-600">
                                        VAT Rate
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        Party Name
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        Document Type
                                    </th>
                               
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-600">
                                        Currency
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        Document Uploaded Date
                                    </th>
                                   
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-600">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedInvoices.map((invoice, index) => (
                                    <tr
                                        key={invoice.id}
                                        className="border-b hover:bg-slate-50 transition"
                                    >
                                        <td className="px-6 py-5 text-slate-500">
                                            {(safePage - 1) * ROWS_PER_PAGE + index + 1}
                                        </td>
                                        <td className="px-6 py-5 font-semibold text-slate-900">
                                            {invoice.invoiceNo}
                                        </td>
                                        <td className="px-6 py-5 text-slate-900">
                                            {formatDateDisplay(invoice.invoiceDate)}
                                        </td>
                                        <td className="px-6 py-5 text-right text-slate-900">
                                            {Number(
                                                invoice.subtotal || 0
                                            ).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </td>
                                        <td className="px-6 py-5 text-right font-semibold text-slate-900">
                                            {Number(
                                                invoice.totalAmount
                                            ).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </td>
                                        <td className="px-6 py-5 text-right text-slate-900">
                                            {Number(
                                                invoice.vatAmount || 0
                                            ).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </td>
                                        <td className="px-6 py-5 text-center text-slate-900">
                                            {invoice.vatRate ? `${invoice.vatRate}%` : "-"}
                                        </td>
                                        <td className="px-6 py-5 text-slate-900">
                                            {invoice.clientName}
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${documentTypeBadgeClass(invoice.documentType)}`}>
                                                {documentTypeLabel(invoice.documentType)}
                                            </span>
                                        </td>
                                     
                                       
                                        <td className="px-6 py-5 text-center">
                                            <span className="inline-flex px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-xs font-semibold">
                                                {invoice.currency}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-slate-900">
                                            {formatDateDisplay(invoice.updatedAt)}
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() =>
                                                        navigate(
                                                            `/dashboard/invoices/${invoice.id}`
                                                        )
                                                    }
                                                    className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition"
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
                                    invoices.length
                                )}{" "}
                                of {invoices.length} invoices
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
                open={confirmOpen}
                title="Delete this client?"
                message={
                    client
                        ? `"${client.company_name}" will be permanently deleted. This cannot be undone.`
                        : ""
                }
                loading={deleting}
                onConfirm={handleDelete}
                onCancel={() => setConfirmOpen(false)}
            />

            <ConfirmDialog
                open={Boolean(deleteInvoiceTarget)}
                title="Delete this invoice?"
                message={
                    deleteInvoiceTarget
                        ? `Invoice ${deleteInvoiceTarget.invoiceNo || ""} will be permanently deleted. This cannot be undone.`
                        : ""
                }
                loading={deletingInvoice}
                onConfirm={confirmDeleteInvoice}
                onCancel={() => setDeleteInvoiceTarget(null)}
            />

        </div>

    );

}
