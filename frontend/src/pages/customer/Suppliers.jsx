import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Truck, AlertCircle, Pencil, Trash2, Power, PowerOff } from "lucide-react";
import toast from "react-hot-toast";
import supplierApi from "../../services/supplierApi";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { isPartyActive, partyStatusLabel, partyStatusBadgeClass } from "../../utils/clientStatus";
import { useAuth } from "../../context/AuthContext";

export default function Suppliers() {

    const navigate = useNavigate();
    const { user } = useAuth();
    const trialExpired = Boolean(user?.subscription?.trial?.isExpired);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [togglingId, setTogglingId] = useState(null);

    useEffect(() => {
        loadSuppliers();
    }, []);

    async function loadSuppliers() {

        setLoading(true);
        setError(null);

        try {

            const res = await supplierApi.getAll();

            setSuppliers(res.suppliers || []);

        } catch (err) {

            setError(
                err.response?.data?.error ||
                    "Could not load suppliers. Please try again."
            );

        } finally {

            setLoading(false);

        }

    }

    function handleDeleteClick(supplier, e) {
        e.preventDefault();
        e.stopPropagation();
        setDeleteTarget(supplier);
    }

    async function confirmDelete() {
        if (!deleteTarget) return;

        try {
            setDeleting(true);
            await supplierApi.delete(deleteTarget.id);
            await loadSuppliers();
            toast.success("Supplier deleted.");
        } catch (err) {
            toast.error(
                err.response?.data?.error ||
                    "Could not delete supplier. Please try again."
            );
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    }

    function handleEdit(supplier, e) {
        e.preventDefault();
        e.stopPropagation();
        navigate(`/dashboard/suppliers/${supplier.id}/edit`);
    }

    async function handleToggleStatus(supplier, e) {
        e.preventDefault();
        e.stopPropagation();

        const nextStatus = isPartyActive(supplier.status) ? "INACTIVE" : "ACTIVE";

        try {
            setTogglingId(supplier.id);
            await supplierApi.updateStatus(supplier.id, nextStatus);
            await loadSuppliers();
            toast.success(
                nextStatus === "ACTIVE"
                    ? `${supplier.company_name} reactivated.`
                    : `${supplier.company_name} deactivated.`
            );
        } catch (err) {
            toast.error(
                err.response?.data?.error ||
                    "Could not update supplier status. Please try again."
            );
        } finally {
            setTogglingId(null);
        }
    }

    const filtered = suppliers.filter(supplier =>
        supplier.company_name
            .toLowerCase()
            .includes(search.toLowerCase())
    );

    return (

        <div className="space-y-6">

            <div className="flex justify-between items-center">

                <div>

                    <h1 className="text-3xl font-bold text-slate-900">
                        Suppliers
                    </h1>

                    <p className="text-slate-500 mt-1">
                        Manage your vendor address book.
                    </p>

                </div>

                {trialExpired ? (
                    <span
                        title="Your free trial has ended. Upgrade your plan to add suppliers."
                        className="px-5 py-3 rounded-xl bg-slate-300 text-slate-500 cursor-not-allowed"
                    >
                        + Add Supplier
                    </span>
                ) : (
                    <Link
                        to="/dashboard/suppliers/new"
                        className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-950/40 transition-all"
                    >
                        + Add Supplier
                    </Link>
                )}

            </div>

            <input
                placeholder="Search supplier..."
                value={search}
                onChange={(e) =>
                    setSearch(e.target.value)
                }
                className="w-full bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            />

            {

                loading ? (

                    <div className="py-20 flex flex-col items-center justify-center">
                        <Loader2
                            size={36}
                            className="animate-spin text-indigo-500"
                        />
                        <p className="mt-4 text-slate-500">
                            Loading suppliers...
                        </p>
                    </div>

                ) : error ? (

                    <div className="py-20 flex flex-col items-center justify-center text-center">
                        <AlertCircle size={48} className="text-red-500" />
                        <h3 className="mt-4 text-xl font-semibold text-slate-900">
                            Couldn't load suppliers
                        </h3>
                        <p className="mt-2 text-slate-500 max-w-sm">
                            {error}
                        </p>
                        <button
                            onClick={loadSuppliers}
                            className="mt-5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all"
                        >
                            Retry
                        </button>
                    </div>

                ) : suppliers.length === 0 ? (

                    <div className="py-20 flex flex-col items-center justify-center text-center">
                        <Truck size={48} className="text-slate-500" />
                        <h3 className="mt-4 text-xl font-semibold text-slate-900">
                            No suppliers yet
                        </h3>
                        <p className="mt-2 text-slate-500 max-w-sm">
                            Add your first supplier to start building your vendor address book.
                        </p>
                        {trialExpired ? (
                            <span
                                title="Your free trial has ended. Upgrade your plan to add suppliers."
                                className="mt-5 px-5 py-2.5 rounded-xl bg-slate-300 text-slate-500 cursor-not-allowed"
                            >
                                + Add Supplier
                            </span>
                        ) : (
                            <Link
                                to="/dashboard/suppliers/new"
                                className="mt-5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all"
                            >
                                + Add Supplier
                            </Link>
                        )}
                    </div>

                ) : filtered.length === 0 ? (

                    <div className="py-20 flex flex-col items-center justify-center text-center">
                        <Truck size={48} className="text-slate-500" />
                        <h3 className="mt-4 text-xl font-semibold text-slate-900">
                            No suppliers match "{search}"
                        </h3>
                        <p className="mt-2 text-slate-500 max-w-sm">
                            Try a different search term.
                        </p>
                    </div>

                ) : (

                    <div className="grid lg:grid-cols-3 gap-6">

                        {

                            filtered.map(supplier => (

                                <div key={supplier.id} className="relative">

                                    <Link
                                        to={`/dashboard/suppliers/${supplier.id}`}
                                        className="block bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-500/50 hover:bg-slate-50 hover:-translate-y-0.5 transition-all duration-300"
                                    >

                                        <div className="flex justify-between items-start pr-24">

                                            <h2 className="font-bold text-xl text-slate-900">

                                                {supplier.company_name}

                                            </h2>

                                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${partyStatusBadgeClass(supplier.status)}`}>

                                                {partyStatusLabel(supplier.status)}

                                            </span>

                                        </div>

                                        <p className="text-slate-500 mt-3">

                                            {supplier.email}

                                        </p>

                                        <p className="text-slate-500">

                                            {supplier.phone}

                                        </p>

                                        <div className="mt-6 flex justify-between">

                                            <span className="text-slate-500">

                                                {supplier.billing_country}

                                            </span>

                                            <span className="text-slate-500">

                                                →

                                            </span>

                                        </div>

                                    </Link>

                                    <div className="absolute top-6 right-6 flex items-center gap-3">

                                        <button
                                            onClick={(e) => handleToggleStatus(supplier, e)}
                                            disabled={togglingId === supplier.id}
                                            aria-label={isPartyActive(supplier.status) ? "Deactivate supplier" : "Activate supplier"}
                                            className={`transition disabled:opacity-50 ${
                                                isPartyActive(supplier.status)
                                                    ? "text-slate-400 hover:text-amber-500"
                                                    : "text-slate-400 hover:text-emerald-500"
                                            }`}
                                            title={isPartyActive(supplier.status) ? "Deactivate supplier" : "Activate supplier"}
                                        >
                                            {isPartyActive(supplier.status) ? (
                                                <PowerOff size={16} />
                                            ) : (
                                                <Power size={16} />
                                            )}
                                        </button>

                                        <button
                                            onClick={(e) => handleEdit(supplier, e)}
                                            aria-label="Edit supplier"
                                            className="text-slate-400 hover:text-indigo-400 transition"
                                            title="Edit supplier"
                                        >
                                            <Pencil size={16} />
                                        </button>

                                        <button
                                            onClick={(e) => handleDeleteClick(supplier, e)}
                                            aria-label="Delete supplier"
                                            className="text-slate-400 hover:text-rose-400 transition"
                                            title="Delete supplier"
                                        >
                                            <Trash2 size={16} />
                                        </button>

                                    </div>

                                </div>

                            ))

                        }

                    </div>

                )

            }

            <ConfirmDialog
                open={Boolean(deleteTarget)}
                title="Delete this supplier?"
                message={
                    deleteTarget
                        ? `"${deleteTarget.company_name}" will be permanently deleted. This cannot be undone.`
                        : ""
                }
                loading={deleting}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTarget(null)}
            />

        </div>

    );

}
