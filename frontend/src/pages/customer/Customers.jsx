import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Users, AlertCircle, Pencil, Trash2, Power, PowerOff } from "lucide-react";
import toast from "react-hot-toast";
import customerApi from "../../services/customerApi";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { isPartyActive, partyStatusLabel, partyStatusBadgeClass } from "../../utils/clientStatus";
import { useAuth } from "../../context/AuthContext";

export default function Customers() {

    const navigate = useNavigate();
    const { user } = useAuth();
    const trialExpired = Boolean(user?.subscription?.trial?.isExpired);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [togglingId, setTogglingId] = useState(null);

    useEffect(() => {
        loadCustomers();
    }, []);

    async function loadCustomers() {

        setLoading(true);
        setError(null);

        try {

            const res = await customerApi.getAll();

            setCustomers(res.customers || []);

        } catch (err) {

            setError(
                err.response?.data?.error ||
                    "Could not load customers. Please try again."
            );

        } finally {

            setLoading(false);

        }

    }

    function handleDeleteClick(customer, e) {
        e.preventDefault();
        e.stopPropagation();
        setDeleteTarget(customer);
    }

    async function confirmDelete() {
        if (!deleteTarget) return;

        try {
            setDeleting(true);
            await customerApi.delete(deleteTarget.id);
            await loadCustomers();
            toast.success("Customer deleted.");
        } catch (err) {
            toast.error(
                err.response?.data?.error ||
                    "Could not delete customer. Please try again."
            );
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    }

    function handleEdit(customer, e) {
        e.preventDefault();
        e.stopPropagation();
        navigate(`/dashboard/customers/${customer.id}/edit`);
    }

    async function handleToggleStatus(customer, e) {
        e.preventDefault();
        e.stopPropagation();

        const nextStatus = isPartyActive(customer.status) ? "INACTIVE" : "ACTIVE";

        try {
            setTogglingId(customer.id);
            await customerApi.updateStatus(customer.id, nextStatus);
            await loadCustomers();
            toast.success(
                nextStatus === "ACTIVE"
                    ? `${customer.company_name} reactivated.`
                    : `${customer.company_name} deactivated.`
            );
        } catch (err) {
            toast.error(
                err.response?.data?.error ||
                    "Could not update customer status. Please try again."
            );
        } finally {
            setTogglingId(null);
        }
    }

    const filtered = customers.filter(customer =>
        customer.company_name
            .toLowerCase()
            .includes(search.toLowerCase())
    );

    return (

        <div className="space-y-6">

            <div className="flex justify-between items-center">

                <div>

                    <h1 className="text-3xl font-bold text-slate-900">
                        Customers
                    </h1>

                    <p className="text-slate-500 mt-1">
                        Manage all your business customers.
                    </p>

                </div>

                {trialExpired ? (
                    <span
                        title="Your free trial has ended. Upgrade your plan to add customers."
                        className="px-5 py-3 rounded-xl bg-slate-300 text-slate-500 cursor-not-allowed"
                    >
                        + Add Customer
                    </span>
                ) : (
                    <Link
                        to="/dashboard/customers/new"
                        className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-950/40 transition-all"
                    >
                        + Add Customer
                    </Link>
                )}

            </div>

            <input
                placeholder="Search customer..."
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
                            Loading customers...
                        </p>
                    </div>

                ) : error ? (

                    <div className="py-20 flex flex-col items-center justify-center text-center">
                        <AlertCircle size={48} className="text-red-500" />
                        <h3 className="mt-4 text-xl font-semibold text-slate-900">
                            Couldn't load customers
                        </h3>
                        <p className="mt-2 text-slate-500 max-w-sm">
                            {error}
                        </p>
                        <button
                            onClick={loadCustomers}
                            className="mt-5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all"
                        >
                            Retry
                        </button>
                    </div>

                ) : customers.length === 0 ? (

                    <div className="py-20 flex flex-col items-center justify-center text-center">
                        <Users size={48} className="text-slate-500" />
                        <h3 className="mt-4 text-xl font-semibold text-slate-900">
                            No customers yet
                        </h3>
                        <p className="mt-2 text-slate-500 max-w-sm">
                            Add your first customer to start uploading and
                            tracking their invoices.
                        </p>
                        {trialExpired ? (
                            <span
                                title="Your free trial has ended. Upgrade your plan to add customers."
                                className="mt-5 px-5 py-2.5 rounded-xl bg-slate-300 text-slate-500 cursor-not-allowed"
                            >
                                + Add Customer
                            </span>
                        ) : (
                            <Link
                                to="/dashboard/customers/new"
                                className="mt-5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all"
                            >
                                + Add Customer
                            </Link>
                        )}
                    </div>

                ) : filtered.length === 0 ? (

                    <div className="py-20 flex flex-col items-center justify-center text-center">
                        <Users size={48} className="text-slate-500" />
                        <h3 className="mt-4 text-xl font-semibold text-slate-900">
                            No customers match "{search}"
                        </h3>
                        <p className="mt-2 text-slate-500 max-w-sm">
                            Try a different search term.
                        </p>
                    </div>

                ) : (

                    <div className="grid lg:grid-cols-3 gap-6">

                        {

                            filtered.map(customer => (

                                <div key={customer.id} className="relative">

                                    <Link
                                        to={`/dashboard/customers/${customer.id}`}
                                        className="block bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-500/50 hover:bg-slate-50 hover:-translate-y-0.5 transition-all duration-300"
                                    >

                                        <div className="flex justify-between items-start pr-24">

                                            <h2 className="font-bold text-xl text-slate-900">

                                                {customer.company_name}

                                            </h2>

                                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${partyStatusBadgeClass(customer.status)}`}>

                                                {partyStatusLabel(customer.status)}

                                            </span>

                                        </div>

                                        <p className="text-slate-500 mt-3">

                                            {customer.contact_person}

                                        </p>

                                        <p className="text-slate-500 mt-1">

                                            {customer.email}

                                        </p>

                                        <p className="text-slate-500">

                                            {customer.phone}

                                        </p>

                                        <div className="mt-6 flex justify-between">

                                            <span className="text-slate-500">

                                                {customer.country}

                                            </span>

                                            <span className="text-slate-500">

                                                →

                                            </span>

                                        </div>

                                    </Link>

                                    <div className="absolute top-6 right-6 flex items-center gap-3">

                                        <button
                                            onClick={(e) => handleToggleStatus(customer, e)}
                                            disabled={togglingId === customer.id}
                                            aria-label={isPartyActive(customer.status) ? "Deactivate customer" : "Activate customer"}
                                            className={`transition disabled:opacity-50 ${
                                                isPartyActive(customer.status)
                                                    ? "text-slate-400 hover:text-amber-500"
                                                    : "text-slate-400 hover:text-emerald-500"
                                            }`}
                                            title={isPartyActive(customer.status) ? "Deactivate customer" : "Activate customer"}
                                        >
                                            {isPartyActive(customer.status) ? (
                                                <PowerOff size={16} />
                                            ) : (
                                                <Power size={16} />
                                            )}
                                        </button>

                                        <button
                                            onClick={(e) => handleEdit(customer, e)}
                                            aria-label="Edit customer"
                                            className="text-slate-400 hover:text-indigo-400 transition"
                                            title="Edit customer"
                                        >
                                            <Pencil size={16} />
                                        </button>

                                        <button
                                            onClick={(e) => handleDeleteClick(customer, e)}
                                            aria-label="Delete customer"
                                            className="text-slate-400 hover:text-rose-400 transition"
                                            title="Delete customer"
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
                title="Delete this customer?"
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
