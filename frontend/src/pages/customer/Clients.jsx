import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Users, AlertCircle, Pencil, Trash2, Power, PowerOff } from "lucide-react";
import toast from "react-hot-toast";
import clientApi from "../../services/clientApi";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { isClientActive, clientStatusLabel, clientStatusBadgeClass } from "../../utils/clientStatus";

export default function Clients() {

    const navigate = useNavigate();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [togglingId, setTogglingId] = useState(null);

    useEffect(() => {
        loadClients();
    }, []);

    async function loadClients() {

        setLoading(true);
        setError(null);

        try {

            const res = await clientApi.getAll();

            setClients(res.clients || []);

        } catch (err) {

            setError(
                err.response?.data?.error ||
                    "Could not load clients. Please try again."
            );

        } finally {

            setLoading(false);

        }

    }

    function handleDeleteClick(client, e) {
        e.preventDefault();
        e.stopPropagation();
        setDeleteTarget(client);
    }

    async function confirmDelete() {
        if (!deleteTarget) return;

        try {
            setDeleting(true);
            await clientApi.delete(deleteTarget.id);
            await loadClients();
            toast.success("Client deleted.");
        } catch (err) {
            toast.error(
                err.response?.data?.error ||
                    "Could not delete client. Please try again."
            );
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    }

    function handleEdit(client, e) {
        e.preventDefault();
        e.stopPropagation();
        navigate(`/dashboard/clients/${client.id}/edit`);
    }

    async function handleToggleStatus(client, e) {
        e.preventDefault();
        e.stopPropagation();

        const nextStatus = isClientActive(client.status) ? "INACTIVE" : "ACTIVE";

        try {
            setTogglingId(client.id);
            await clientApi.updateStatus(client.id, nextStatus);
            await loadClients();
            toast.success(
                nextStatus === "ACTIVE"
                    ? `${client.company_name} reactivated.`
                    : `${client.company_name} deactivated.`
            );
        } catch (err) {
            toast.error(
                err.response?.data?.error ||
                    "Could not update client status. Please try again."
            );
        } finally {
            setTogglingId(null);
        }
    }

    const filtered = clients.filter(client =>
        client.company_name
            .toLowerCase()
            .includes(search.toLowerCase())
    );

    return (

        <div className="space-y-6">

            <div className="flex justify-between items-center">

                <div>

                    <h1 className="text-3xl font-bold text-slate-900">
                        Clients
                    </h1>

                    <p className="text-slate-500 mt-1">
                        Manage all your business clients.
                    </p>

                </div>

                <Link
                    to="/dashboard/clients/new"
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-950/40 transition-all"
                >
                    + Add Client
                </Link>

            </div>

            <input
                placeholder="Search client..."
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
                            Loading clients...
                        </p>
                    </div>

                ) : error ? (

                    <div className="py-20 flex flex-col items-center justify-center text-center">
                        <AlertCircle size={48} className="text-red-500" />
                        <h3 className="mt-4 text-xl font-semibold text-slate-900">
                            Couldn't load clients
                        </h3>
                        <p className="mt-2 text-slate-500 max-w-sm">
                            {error}
                        </p>
                        <button
                            onClick={loadClients}
                            className="mt-5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all"
                        >
                            Retry
                        </button>
                    </div>

                ) : clients.length === 0 ? (

                    <div className="py-20 flex flex-col items-center justify-center text-center">
                        <Users size={48} className="text-slate-500" />
                        <h3 className="mt-4 text-xl font-semibold text-slate-900">
                            No clients yet
                        </h3>
                        <p className="mt-2 text-slate-500 max-w-sm">
                            Add your first client to start uploading and
                            tracking their invoices.
                        </p>
                        <Link
                            to="/dashboard/clients/new"
                            className="mt-5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all"
                        >
                            + Add Client
                        </Link>
                    </div>

                ) : filtered.length === 0 ? (

                    <div className="py-20 flex flex-col items-center justify-center text-center">
                        <Users size={48} className="text-slate-500" />
                        <h3 className="mt-4 text-xl font-semibold text-slate-900">
                            No clients match "{search}"
                        </h3>
                        <p className="mt-2 text-slate-500 max-w-sm">
                            Try a different search term.
                        </p>
                    </div>

                ) : (

                    <div className="grid lg:grid-cols-3 gap-6">

                        {

                            filtered.map(client => (

                                <div key={client.id} className="relative">

                                    <Link
                                        to={`/dashboard/clients/${client.id}`}
                                        className="block bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-500/50 hover:bg-slate-50 hover:-translate-y-0.5 transition-all duration-300"
                                    >

                                        <div className="flex justify-between items-start pr-24">

                                            <h2 className="font-bold text-xl text-slate-900">

                                                {client.company_name}

                                            </h2>

                                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${clientStatusBadgeClass(client.status)}`}>

                                                {clientStatusLabel(client.status)}

                                            </span>

                                        </div>

                                        <p className="text-slate-500 mt-3">

                                            {client.contact_person}

                                        </p>

                                        <p className="text-slate-500 mt-1">

                                            {client.email}

                                        </p>

                                        <p className="text-slate-500">

                                            {client.phone}

                                        </p>

                                        <div className="mt-6 flex justify-between">

                                            <span className="text-slate-500">

                                                {client.country}

                                            </span>

                                            <span className="text-slate-500">

                                                →

                                            </span>

                                        </div>

                                    </Link>

                                    <div className="absolute top-6 right-6 flex items-center gap-3">

                                        <button
                                            onClick={(e) => handleToggleStatus(client, e)}
                                            disabled={togglingId === client.id}
                                            aria-label={isClientActive(client.status) ? "Deactivate client" : "Activate client"}
                                            className={`transition disabled:opacity-50 ${
                                                isClientActive(client.status)
                                                    ? "text-slate-400 hover:text-amber-500"
                                                    : "text-slate-400 hover:text-emerald-500"
                                            }`}
                                            title={isClientActive(client.status) ? "Deactivate client" : "Activate client"}
                                        >
                                            {isClientActive(client.status) ? (
                                                <PowerOff size={16} />
                                            ) : (
                                                <Power size={16} />
                                            )}
                                        </button>

                                        <button
                                            onClick={(e) => handleEdit(client, e)}
                                            aria-label="Edit client"
                                            className="text-slate-400 hover:text-indigo-400 transition"
                                            title="Edit client"
                                        >
                                            <Pencil size={16} />
                                        </button>

                                        <button
                                            onClick={(e) => handleDeleteClick(client, e)}
                                            aria-label="Delete client"
                                            className="text-slate-400 hover:text-rose-400 transition"
                                            title="Delete client"
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
                title="Delete this client?"
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