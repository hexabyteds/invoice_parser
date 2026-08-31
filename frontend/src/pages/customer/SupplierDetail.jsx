import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import supplierApi from "../../services/supplierApi.js";
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
import { deleteInvoices, getInvoicesBySupplier } from "../../services/invoiceApi";
import { formatDateDisplay } from "../../utils/formatDate";
import { documentTypeLabel, documentTypeBadgeClass } from "../../utils/documentTypes";
import { isPartyActive, partyStatusLabel, partyStatusBadgeClass } from "../../utils/clientStatus";

const ROWS_PER_PAGE = 10;

export default function SupplierDetail() {

    const { id } = useParams();

    const [supplier, setSupplier] = useState(null);
    const [bills, setBills] = useState([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteBillTarget, setDeleteBillTarget] = useState(null);
    const [deletingBill, setDeletingBill] = useState(false);
    const [togglingStatus, setTogglingStatus] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        setPage(1);
        load();
    }, [id]);

    async function load() {

        setLoading(true);
        setError(null);

        try {

            const res = await supplierApi.get(id);
            const billsRes = await getInvoicesBySupplier(id);

            setSupplier(res.supplier);
            setBills(billsRes?.data?.invoices || []);

        } catch (err) {

            setSupplier(null);
            setBills([]);
            setError(
                err.response?.data?.error ||
                    "Could not load this supplier. Please try again."
            );

        } finally {

            setLoading(false);

        }

    }

    async function confirmDeleteBill() {
        if (!deleteBillTarget) return;

        try {
            setDeletingBill(true);
            await deleteInvoices(deleteBillTarget.id);
            await load();
            toast.success("Bill deleted.");
        } catch (err) {
            toast.error(
                err.response?.data?.error ||
                    "Could not delete bill. Please try again."
            );
        } finally {
            setDeletingBill(false);
            setDeleteBillTarget(null);
        }
    }

    const totalPages = Math.max(1, Math.ceil(bills.length / ROWS_PER_PAGE));
    const safePage = Math.min(page, totalPages);

    const paginatedBills = useMemo(() => {
        const start = (safePage - 1) * ROWS_PER_PAGE;
        return bills.slice(start, start + ROWS_PER_PAGE);
    }, [bills, safePage]);

    async function handleDelete() {
        try {
            setDeleting(true);
            await supplierApi.delete(id);
            toast.success("Supplier deleted.");
            navigate("/dashboard/suppliers");
        } catch (err) {
            toast.error(
                err.response?.data?.error ||
                    "Could not delete supplier. Please try again."
            );
        } finally {
            setDeleting(false);
            setConfirmOpen(false);
        }
    }

    async function handleToggleStatus() {
        if (!supplier) return;

        const nextStatus = isPartyActive(supplier.status) ? "INACTIVE" : "ACTIVE";

        try {
            setTogglingStatus(true);
            const res = await supplierApi.updateStatus(id, nextStatus);
            setSupplier(res.supplier);
            toast.success(
                nextStatus === "ACTIVE" ? "Supplier reactivated." : "Supplier deactivated."
            );
        } catch (err) {
            toast.error(
                err.response?.data?.error ||
                    "Could not update supplier status. Please try again."
            );
        } finally {
            setTogglingStatus(false);
        }
    }

    if (loading) {
        return (
            <div className="py-20 flex flex-col items-center justify-center">
                <Loader2 size={36} className="animate-spin text-indigo-600" />
                <p className="mt-4 text-slate-500">
                    Loading supplier...
                </p>
            </div>
        );
    }

    if (error || !supplier) {
        return (
            <div className="py-20 flex flex-col items-center justify-center text-center">
                <AlertCircle size={48} className="text-red-500" />
                <h3 className="mt-4 text-xl font-semibold text-slate-900">
                    Couldn't load supplier
                </h3>
                <p className="mt-2 text-slate-500 max-w-sm">
                    {error || "This supplier no longer exists."}
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
                        onClick={() => navigate("/dashboard/suppliers")}
                        className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
                    >
                        Back to suppliers
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

                                {supplier.company_name}

                            </h1>

                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${partyStatusBadgeClass(supplier.status)}`}>
                                {partyStatusLabel(supplier.status)}
                            </span>
                        </div>

                        <p className="text-slate-500 mt-3">

                            {[supplier.primary_contact_first_name, supplier.primary_contact_last_name]
                                .filter(Boolean)
                                .join(" ")}

                        </p>
                    </div>

                    <div className="flex items-center gap-3">

                        <button
                            type="button"
                            onClick={handleToggleStatus}
                            disabled={togglingStatus}
                            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border transition disabled:opacity-60 ${
                                isPartyActive(supplier.status)
                                    ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                        >
                            {isPartyActive(supplier.status) ? (
                                <PowerOff size={16} />
                            ) : (
                                <Power size={16} />
                            )}
                            {togglingStatus
                                ? "Updating..."
                                : isPartyActive(supplier.status)
                                    ? "Deactivate"
                                    : "Activate"}
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                navigate(`/dashboard/suppliers/${id}/edit`)
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
                        <h3 className="text-slate-500 text-sm">Email</h3>
                        <p className="text-slate-900 mt-1">{supplier.email}</p>
                    </div>

                    <div>
                        <h3 className="text-slate-500 text-sm">Phone</h3>
                        <p className="text-slate-900 mt-1">{supplier.phone}</p>
                    </div>

                    <div>
                        <h3 className="text-slate-500 text-sm">Country</h3>
                        <p className="text-slate-900 mt-1">{supplier.billing_country}</p>
                    </div>

                    <div>
                        <h3 className="text-slate-500 text-sm">TRN</h3>
                        <p className="text-slate-900 mt-1">{supplier.trn}</p>
                    </div>

                </div>

            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">

                <h2 className="text-xl font-semibold text-slate-900 mb-6">
                    Vendor Details
                </h2>

                <div className="grid grid-cols-4 gap-6">

                    <div>
                        <h3 className="text-slate-500 text-sm">Vendor Type</h3>
                        <p className="text-slate-900 mt-1">{supplier.vendor_type || "-"}</p>
                    </div>

                    <div>
                        <h3 className="text-slate-500 text-sm">Currency</h3>
                        <p className="text-slate-900 mt-1">{supplier.currency || "-"}</p>
                    </div>

                    <div>
                        <h3 className="text-slate-500 text-sm">Payment Terms</h3>
                        <p className="text-slate-900 mt-1">{supplier.payment_terms || "-"}</p>
                    </div>

                    <div>
                        <h3 className="text-slate-500 text-sm">Tax Treatment</h3>
                        <p className="text-slate-900 mt-1">{supplier.tax_treatment || "-"}</p>
                    </div>

                    <div>
                        <h3 className="text-slate-500 text-sm">Vendor Category</h3>
                        <p className="text-slate-900 mt-1">{supplier.vendor_category || "-"}</p>
                    </div>

                    <div>
                        <h3 className="text-slate-500 text-sm">Vendor Classification</h3>
                        <p className="text-slate-900 mt-1">{supplier.vendor_classification || "-"}</p>
                    </div>

                    <div>
                        <h3 className="text-slate-500 text-sm">Procurement Category</h3>
                        <p className="text-slate-900 mt-1">{supplier.procurement_category || "-"}</p>
                    </div>

                    <div>
                        <h3 className="text-slate-500 text-sm">Default Expense Account</h3>
                        <p className="text-slate-900 mt-1">{supplier.default_expense_account || "-"}</p>
                    </div>

                </div>

            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                <div className="px-6 py-5 border-b">
                    <h2 className="text-xl font-semibold text-slate-900">
                        Supplier Bills
                    </h2>
                </div>

                {bills.length === 0 ? (
                    <div className="py-20 text-center">
                        <FileText
                            size={60}
                            className="mx-auto text-slate-300"
                        />
                        <h3 className="mt-5 text-xl font-semibold text-slate-700">
                            No documents found
                        </h3>
                        <p className="mt-2 text-slate-500">
                            No bills for this supplier yet.
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
                                {paginatedBills.map((bill, index) => (
                                    <tr
                                        key={bill.id}
                                        className="border-b hover:bg-slate-50 transition"
                                    >
                                        <td className="px-6 py-5 text-slate-500">
                                            {(safePage - 1) * ROWS_PER_PAGE + index + 1}
                                        </td>
                                        <td className="px-6 py-5 font-semibold text-slate-900">
                                            {bill.invoiceNo}
                                        </td>
                                        <td className="px-6 py-5 text-slate-900">
                                            {formatDateDisplay(bill.invoiceDate)}
                                        </td>
                                        <td className="px-6 py-5 text-right text-slate-900">
                                            {Number(
                                                bill.subtotal || 0
                                            ).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </td>
                                        <td className="px-6 py-5 text-right font-semibold text-slate-900">
                                            {Number(
                                                bill.totalAmount
                                            ).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </td>
                                        <td className="px-6 py-5 text-right text-slate-900">
                                            {Number(
                                                bill.vatAmount || 0
                                            ).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </td>
                                        <td className="px-6 py-5 text-center text-slate-900">
                                            {bill.vatRate ? `${bill.vatRate}%` : "-"}
                                        </td>
                                        <td className="px-6 py-5 text-slate-900">
                                            {bill.clientName}
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${documentTypeBadgeClass(bill.documentType)}`}>
                                                {documentTypeLabel(bill.documentType)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="inline-flex px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-xs font-semibold">
                                                {bill.currency}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-slate-900">
                                            {formatDateDisplay(bill.updatedAt)}
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() =>
                                                        navigate(
                                                            `/dashboard/invoices/${bill.id}`,
                                                            {
                                                                state: {
                                                                    invoiceIds: bills.map(
                                                                        (b) => b.id
                                                                    ),
                                                                },
                                                            }
                                                        )
                                                    }
                                                    className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        navigate(
                                                            `/dashboard/invoices/${bill.id}/edit`
                                                        )
                                                    }
                                                    className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-amber-100 text-amber-600 flex items-center justify-center transition"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setDeleteBillTarget(bill)
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
                                    bills.length
                                )}{" "}
                                of {bills.length} bills
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
                title="Delete this supplier?"
                message={
                    supplier
                        ? `"${supplier.company_name}" will be permanently deleted. This cannot be undone.`
                        : ""
                }
                loading={deleting}
                onConfirm={handleDelete}
                onCancel={() => setConfirmOpen(false)}
            />

            <ConfirmDialog
                open={Boolean(deleteBillTarget)}
                title="Delete this bill?"
                message={
                    deleteBillTarget
                        ? `Bill ${deleteBillTarget.invoiceNo || ""} will be permanently deleted. This cannot be undone.`
                        : ""
                }
                loading={deletingBill}
                onConfirm={confirmDeleteBill}
                onCancel={() => setDeleteBillTarget(null)}
            />

        </div>

    );

}
