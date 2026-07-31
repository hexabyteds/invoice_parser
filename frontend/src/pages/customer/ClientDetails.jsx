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
    Loader2,
    Pencil,
    Trash2,
} from "lucide-react";


import {
    getInvoicesByClient,
  } from "../../services/invoiceApi";

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
                <Loader2 size={36} className="animate-spin text-blue-500" />
                <p className="mt-4 text-gray-400">
                    Loading client...
                </p>
            </div>
        );
    }

    if (error || !client) {
        return (
            <div className="py-20 flex flex-col items-center justify-center text-center">
                <AlertCircle size={48} className="text-red-500" />
                <h3 className="mt-4 text-xl font-semibold">
                    Couldn't load client
                </h3>
                <p className="mt-2 text-gray-400 max-w-sm">
                    {error || "This client no longer exists."}
                </p>
                <div className="mt-5 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={load}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700"
                    >
                        Retry
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/dashboard/clients")}
                        className="px-5 py-2.5 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700"
                    >
                        Back to clients
                    </button>
                </div>
            </div>
        );
    }

    return (

        <div className="space-y-8">

            <div className="bg-slate-900 rounded-2xl p-8">

                <div className="flex items-start justify-between gap-4">

                    <div>
                        <h1 className="text-4xl font-bold">

                            {client.company_name}

                        </h1>

                        <p className="text-gray-400 mt-3">

                            {client.contact_person}

                        </p>
                    </div>

                    <div className="flex items-center gap-3">

                        <button
                            type="button"
                            onClick={() =>
                                navigate(`/dashboard/clients/${id}/edit`)
                            }
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 transition"
                        >
                            <Pencil size={16} />
                            Edit
                        </button>

                        <button
                            type="button"
                            onClick={() => setConfirmOpen(true)}
                            disabled={deleting}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-900 bg-red-950/40 text-red-400 hover:bg-red-950 transition disabled:opacity-60"
                        >
                            <Trash2 size={16} />
                            {deleting ? "Deleting..." : "Delete"}
                        </button>

                    </div>

                </div>

                <div className="grid grid-cols-4 gap-6 mt-8">

                    <div>

                        <h3 className="text-gray-500">

                            Email

                        </h3>

                        <p>

                            {client.email}

                        </p>

                    </div>

                    <div>

                        <h3 className="text-gray-500">

                            Phone

                        </h3>

                        <p>

                            {client.phone}

                        </p>

                    </div>

                    <div>

                        <h3 className="text-gray-500">

                            Country

                        </h3>

                        <p>

                            {client.country}

                        </p>

                    </div>

                    <div>

                        <h3 className="text-gray-500">

                            TRN

                        </h3>

                        <p>

                            {client.trn}

                        </p>

                    </div>

                </div>

            </div>

            {/* <div className="grid md:grid-cols-4 gap-6">

                <button
                  onClick={() => navigate(`/dashboard/upload/${id}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-5 font-semibold transition"
                >
                    Upload Invoice
                </button>

                <button
                  onClick={handleDownloadExcel}
                  disabled={downloading}
                  className="bg-slate-800 hover:bg-slate-700 text-white rounded-xl p-5 font-semibold transition disabled:opacity-60"
                >
                    {downloading ? "Downloading..." : "Download Excel"}
                </button>

                <button className="bg-slate-800 rounded-xl p-5">

                    Generate Report

                </button>

                <button
                  onClick={() => navigate(`/dashboard/analytics?client=${id}`)}
                  className="bg-slate-800 hover:bg-slate-700 text-white rounded-xl p-5 font-semibold transition"
                >
                    Analytics
                </button>

            </div> */}

            <div className="bg-slate-900 rounded-2xl p-6">

                <h2 className="text-2xl font-bold mb-6">

                    Client Invoices

                </h2>

                <table className="w-full">

                    <thead>

                        <tr className="text-left border-b border-slate-700">

                            <th className="py-3">

                                Invoice

                            </th>

                            <th>

                                Date

                            </th>

                            <th>

                                Total

                            </th>

                            <th>

                                VAT

                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        {paginatedInvoices.map((invoice) => (

                                <tr
                                    key={invoice.id}
                                    className="border-b border-slate-800"
                                >

                                    <td className="py-4">

                                        {invoice.invoiceNo}

                                    </td>

                                    <td>

                                        {invoice.invoiceDate}

                                    </td>

                                    <td>

                                        {invoice.currency}

                                        {" "}

                                        {invoice.totalAmount}

                                    </td>

                                    <td>

                                        {invoice.vatAmount}

                                    </td>

                                </tr>

                            ))}

                    </tbody>

                </table>

                {invoices.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-700">
                        <p className="text-sm text-gray-400">
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
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-sm font-medium text-gray-200 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition"
                            >
                                <ChevronLeft size={18} />
                                Previous
                            </button>

                            <span className="text-sm text-gray-400 px-2">
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
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-sm font-medium text-gray-200 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition"
                            >
                                Next
                                <ChevronRight size={18} />
                            </button>
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

        </div>

    );

}