import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import clientApi from "../../services/clientApi.js";
import { useNavigate } from "react-router-dom";


import {
    getInvoicesByClient,
  } from "../../services/invoiceApi";
export default function ClientDetails() {

    const { id } = useParams();

    const [client, setClient] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [downloading, setDownloading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        load();
    }, [id]);

    async function load() {
        const clientRes = await clientApi.get(id);
        const invoiceRes = await getInvoicesByClient(id);

        setClient(clientRes.client);
        setInvoices(invoiceRes?.data?.invoices || []);
    }

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
    
            console.error(err);
    
            alert(err.message);
    
        } finally {
    
            setDownloading(false);
    
        }
    
    }
    if (!client) {
        return <p>Loading...</p>;
    }

    return (

        <div className="space-y-8">

            <div className="bg-slate-900 rounded-2xl p-8">

                <h1 className="text-4xl font-bold">

                    {client.company_name}

                </h1>

                <p className="text-gray-400 mt-3">

                    {client.contact_person}

                </p>

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

            <div className="grid md:grid-cols-4 gap-6">

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

            </div>

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

                        {

                            invoices.map(invoice => (

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

                            ))

                        }

                    </tbody>

                </table>

            </div>

        </div>

    );

}