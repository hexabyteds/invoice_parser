import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import clientApi from "../services/clientApi";

export default function Clients() {

    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        loadClients();
    }, []);

    async function loadClients() {

        try {

            const res = await clientApi.getAll();

            setClients(res.clients);

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

                <button
                    className="bg-blue-600 hover:bg-blue-700 rounded-xl px-5 py-3 font-semibold"
                >
                    + Add Client
                </button>

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

                loading ?

                    <p>Loading...</p>

                    :

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

            }

        </div>

    );

}