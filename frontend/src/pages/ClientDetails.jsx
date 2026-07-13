import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import clientApi from "../services/clientApi.js";
 
import {
    getInvoicesByClient,
  } from "../services/invoiceApi";
export default function ClientDetails() {

    const { id } = useParams();

    const [client, setClient] = useState(null);

    const [invoices, setInvoices] = useState([]);

    useEffect(() => {
        console.log("id", id);
        load();

    }, []);

    async function load() {
        console.log("load");
        const clientRes =
            await clientApi.get(id);

            const invoiceRes = await getInvoicesByClient(id);
        console.log("invoiceRes", invoiceRes?.data?.invoices);
        setClient(clientRes.client);

        setInvoices(invoiceRes?.data?.invoices);

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

                <button className="bg-blue-600 rounded-xl p-5">

                    Upload Invoice

                </button>

                <button className="bg-slate-800 rounded-xl p-5">

                    Download Excel

                </button>

                <button className="bg-slate-800 rounded-xl p-5">

                    Generate Report

                </button>

                <button className="bg-slate-800 rounded-xl p-5">

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