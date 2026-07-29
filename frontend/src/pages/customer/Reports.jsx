// src/pages/Reports.jsx

import { useEffect, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  DollarSign,
  Receipt,
  Users,
  BadgeDollarSign,
} from "lucide-react";

import { getAnalytics } from "../../services/analyticsApi";
import { getInvoices } from "../../services/invoiceApi";
import {
  downloadExcel,
  openHtmlReport,
} from "../../services/reportApi";

export default function Reports() {
  const [analytics, setAnalytics] = useState({});
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    try {
      const [analyticsRes, invoiceRes] = await Promise.all([
        getAnalytics(),
        getInvoices(),
      ]);

      setAnalytics(analyticsRes.data.analytics);
      setInvoices(invoiceRes.data.invoices);
    } catch (err) {
    
    } finally {
      setLoading(false);
    }
  }

  async function handleExcel() {
    try {
      const res = await downloadExcel();

      const url = window.URL.createObjectURL(
        new Blob([res.data])
      );

      const link = document.createElement("a");

      link.href = url;
      link.download = "Invoices.xlsx";

      link.click();
    } catch (err) {
 
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-8">

      {/* Header */}

      <div>

        <h1 className="text-3xl font-bold text-black">
          Reports
        </h1>

        <p className="text-slate-500 mt-2">
          Export and analyze all invoice data.
        </p>

      </div>

      {/* Cards */}

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">

        <Card
          icon={<Receipt />}
          title="Invoices"
          value={analytics.totalInvoices}
        />

        <Card
          icon={<DollarSign />}
          title="Revenue"
          value={`AED ${Number(
            analytics.totalRevenue
          ).toLocaleString()}`}
        />

        <Card
          icon={<BadgeDollarSign />}
          title="VAT"
          value={`AED ${Number(
            analytics.totalVAT
          ).toLocaleString()}`}
        />

        <Card
          icon={<Users />}
          title="Clients"
          value={analytics.totalClients}
        />

      </div>

      {/* Export */}

      <div className="bg-white rounded-3xl shadow border p-8">

        <h2 className="text-xl font-semibold mb-6">
          Export Reports
        </h2>

        <div className="flex flex-wrap gap-4">

          <button
            onClick={handleExcel}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl"
          >
            <FileSpreadsheet size={20} />
            Download Excel
          </button>

          <button
            onClick={openHtmlReport}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl"
          >
            <FileText size={20} />
            HTML Report
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-6 py-3 rounded-xl"
          >
            <Printer size={20} />
            Print
          </button>

        </div>

      </div>

      {/* Recent Invoices */}

      <div className="bg-white rounded-3xl shadow border overflow-hidden">

        <div className="p-6 border-b">

          <h2 className="text-xl font-semibold text-black">
            Recent Invoices
          </h2>

        </div>

        <table className="w-full">

          <thead className="bg-slate-50">

            <tr>

              <th className="text-left px-6 py-4 font-medium text-black">
                Invoice
              </th>

              <th className="text-left px-6 py-4 font-medium text-black">
                Client
              </th>

              <th className="text-left px-6 py-4 font-medium text-black">
                Date
              </th>

              <th className="text-right px-6 py-4 font-medium text-black">
                Amount
              </th>

            </tr>

          </thead>

          <tbody>

            {invoices.slice(0, 10).map((invoice) => (

              <tr
                key={invoice.id}
                className="border-t hover:bg-slate-50"
              >

                <td className="px-6 py-4 font-medium text-black">
                  {invoice.invoiceNo}
                </td>

                <td className="px-6 py-4 font-medium text-black">
                  {invoice.clientName}
                </td>

                <td className="px-6 py-4 font-medium text-black">
                  {new Date(
                    invoice.invoiceDate
                  ).toLocaleDateString()}
                </td>

                <td className="px-6 py-4 text-right font-medium text-black">

                  {invoice.currency}{" "}
                  {Number(
                    invoice.totalAmount
                  ).toFixed(2)}

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}

function Card({ icon, title, value }) {
  return (
    <div className="bg-white rounded-3xl shadow border p-6">

      <div className="flex items-center gap-3 text-blue-600 mb-4">
        {icon}
      </div>

      <div className="text-sm text-slate-500 font-medium">
        {title}
      </div>

      <div className="text-3xl font-bold mt-2 text-black">
        {value}
      </div>

    </div>
  );
}