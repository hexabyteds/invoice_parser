import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import supplierApi from "../../services/supplierApi.js";
import toast from "react-hot-toast";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import {
    AlertCircle,
    Loader2,
    Pencil,
    Power,
    PowerOff,
    Trash2,
} from "lucide-react";
import { isPartyActive, partyStatusLabel, partyStatusBadgeClass } from "../../utils/clientStatus";

export default function SupplierDetail() {

    const { id } = useParams();

    const [supplier, setSupplier] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [togglingStatus, setTogglingStatus] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        load();
    }, [id]);

    async function load() {

        setLoading(true);
        setError(null);

        try {

            const res = await supplierApi.get(id);
            setSupplier(res.supplier);

        } catch (err) {

            setSupplier(null);
            setError(
                err.response?.data?.error ||
                    "Could not load this supplier. Please try again."
            );

        } finally {

            setLoading(false);

        }

    }

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

        </div>

    );

}
