import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Users, AlertCircle } from "lucide-react";
import clientApi from "../../services/clientApi";

export default function Clients() {

    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");

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

    const filtered = clients.filter(client =>
        client.company_name
            .toLowerCase()
            .includes(search.toLowerCase())
    );

    return (

        <div className="space-y-6">

            <div className="flex justify-between items-center">

                <div>

                    <h1 className="text-3xl font-bold">
                        Clients
                    </h1>

                    <p className="text-gray-400 mt-1">
                        Manage all your business clients.
                    </p>

                </div>

                <Link
                    to="/dashboard/clients/new"
                    className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700"
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
                className="w-full bg-slate-800 rounded-xl px-4 py-3"
            />

            {

                loading ? (

                    <div className="py-20 flex flex-col items-center justify-center">
                        <Loader2
                            size={36}
                            className="animate-spin text-blue-500"
                        />
                        <p className="mt-4 text-gray-400">
                            Loading clients...
                        </p>
                    </div>

                ) : error ? (

                    <div className="py-20 flex flex-col items-center justify-center text-center">
                        <AlertCircle size={48} className="text-red-500" />
                        <h3 className="mt-4 text-xl font-semibold">
                            Couldn't load clients
                        </h3>
                        <p className="mt-2 text-gray-400 max-w-sm">
                            {error}
                        </p>
                        <button
                            onClick={loadClients}
                            className="mt-5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700"
                        >
                            Retry
                        </button>
                    </div>

                ) : clients.length === 0 ? (

                    <div className="py-20 flex flex-col items-center justify-center text-center">
                        <Users size={48} className="text-slate-500" />
                        <h3 className="mt-4 text-xl font-semibold">
                            No clients yet
                        </h3>
                        <p className="mt-2 text-gray-400 max-w-sm">
                            Add your first client to start uploading and
                            tracking their invoices.
                        </p>
                        <Link
                            to="/dashboard/clients/new"
                            className="mt-5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700"
                        >
                            + Add Client
                        </Link>
                    </div>

                ) : filtered.length === 0 ? (

                    <div className="py-20 flex flex-col items-center justify-center text-center">
                        <Users size={48} className="text-slate-500" />
                        <h3 className="mt-4 text-xl font-semibold">
                            No clients match "{search}"
                        </h3>
                        <p className="mt-2 text-gray-400 max-w-sm">
                            Try a different search term.
                        </p>
                    </div>

                ) : (

                    <div className="grid lg:grid-cols-3 gap-6">

                        {

                            filtered.map(client => (

                                <Link
                                    key={client.id}
                                    to={`/dashboard/clients/${client.id}`}
                                >

                                    <div className="bg-slate-900 rounded-2xl p-6 hover:border hover:border-blue-500 transition">

                                        <div className="flex justify-between">

                                            <h2 className="font-bold text-xl">

                                                {client.company_name}

                                            </h2>

                                            <span className="text-green-400">

                                                {client.status}

                                            </span>

                                        </div>

                                        <p className="text-gray-400 mt-3">

                                            {client.contact_person}

                                        </p>

                                        <p className="text-gray-500 mt-1">

                                            {client.email}

                                        </p>

                                        <p className="text-gray-500">

                                            {client.phone}

                                        </p>

                                        <div className="mt-6 flex justify-between">

                                            <span>

                                                {client.country}

                                            </span>

                                            <span>

                                                →

                                            </span>

                                        </div>

                                    </div>

                                </Link>

                            ))

                        }

                    </div>

                )

            }

        </div>

    );

}