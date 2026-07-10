import { useEffect, useMemo, useState } from "react";
import {
    Search,
    Plus,
    Eye,
    Trash2,
    FileText,
    Loader2,
} from "lucide-react";
import {
    getInvoices,
  } from "../services/invoiceApi";
import { useNavigate } from "react-router-dom";

export default function Invoices() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const navigate = useNavigate();
    async function loadInvoices() {
        try {
            setLoading(true);

            const res = await getInvoices();
            console.log("invoices",res.data.invoices);
            setInvoices(res.data.invoices || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadInvoices();
    }, []);

    const filteredInvoices = useMemo(() => {
        return invoices.filter((invoice) => {
            const keyword = search.toLowerCase();

            return (
                invoice.invoice_no
                    ?.toLowerCase()
                    .includes(keyword) ||

                invoice.client_name
                    ?.toLowerCase()
                    .includes(keyword) ||

                invoice.currency
                    ?.toLowerCase()
                    .includes(keyword)
            );
        });
    }, [search, invoices]);

    async function handleDelete(id) {
        const ok = window.confirm(
            "Delete this invoice?"
        );

        if (!ok) return;

        try {
            await deleteInvoice(id);

            loadInvoices();
        } catch (err) {
            console.error(err);
        }
    }
    return (
        <div className="space-y-8">

            {/* ===========================
          Header
      =========================== */}

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

                <div>

                    <h1 className="text-3xl font-bold text-slate-800">
                        Invoices
                    </h1>

                    <p className="text-slate-500 mt-2">
                        Manage and view all processed invoices.
                    </p>

                </div>

                <button
                    onClick={() =>
                        navigate(`/dashboard/invoices`)
                    }
                    className="
    w-10
    h-10
    rounded-lg
    bg-slate-100
    hover:bg-blue-100
    text-blue-600
    flex
    items-center
    justify-center
    transition
  "
                >
                    <Eye size={18} />
                </button>

            </div>

            {/* ===========================
          Search
      =========================== */}

            <div
                className="
          bg-white
          rounded-2xl
          border
          border-slate-200
          shadow-sm
          p-5
        "
            >

                <div className="relative max-w-md">

                    <Search
                        size={18}
                        className="
              absolute
              left-4
              top-1/2
              -translate-y-1/2
              text-slate-400
            "
                    />

                    <input
                        type="text"
                        placeholder="Search invoice number, client..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="
              w-full
              rounded-xl
              border
              border-slate-200
              bg-slate-50
              pl-11
              pr-4
              py-3
              outline-none
              focus:ring-2
              focus:ring-blue-500
              focus:border-blue-500
              transition
            "
                    />

                </div>

            </div>

            {/* ===========================
          Invoice Table Card
      =========================== */}

            <div
                className="
          bg-white
          rounded-2xl
          border
          border-slate-200
          shadow-sm
          overflow-hidden
        "
            >
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
                            Upload your first invoice to get started.
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
                                        Client
                                    </th>

                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                                        Date
                                    </th>

                                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-600">
                                        Amount
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

                                {filteredInvoices.map((invoice) => (

                                    <tr
                                        key={invoice.id}
                                        className="border-b hover:bg-slate-50 transition"
                                    >

<td className="px-6 py-5 font-semibold text-blue-600">
    {invoice.invoiceNo}
</td>

<td className="px-6 py-5 text-blue-300">
    {invoice.clientName}
</td>

<td className="px-6 py-5 text-blue-300">
    {new Date(invoice.invoiceDate).toLocaleDateString()}
</td>

<td className="px-6 py-5 text-right font-semibold text-blue-300">
    {Number(invoice.totalAmount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}
</td>

<td className="px-6 py-5 text-center text-blue-300">
    <span className="inline-flex px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
        {invoice.currency}
    </span>
</td>
                                        <td className="px-6 py-5">

                                            <div className="flex justify-center gap-2">

                                                <button
                                                    className="
                  w-10
                  h-10
                  rounded-lg
                  bg-slate-100
                  hover:bg-blue-100
                  flex
                  items-center
                  justify-center
                  transition
                "
                                                >
                                                    <Eye size={18} />
                                                </button>

                                                <button
                                                    onClick={() =>
                                                        handleDelete(invoice.id)
                                                    }
                                                    className="
                  w-10
                  h-10
                  rounded-lg
                  bg-slate-100
                  hover:bg-red-100
                  text-red-600
                  flex
                  items-center
                  justify-center
                  transition
                "
                                                >
                                                    <Trash2 size={18} />
                                                </button>

                                            </div>

                                        </td>

                                    </tr>

                                ))}

                            </tbody>

                        </table>

                    </div>

                )}
            </div>

        </div>
    );
}