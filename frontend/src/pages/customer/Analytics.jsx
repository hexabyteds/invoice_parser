import { useEffect, useState } from "react";
import {
  FileText,
  DollarSign,
  Receipt,
  Calendar,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { getAnalytics } from "../../services/analyticsApi";
import clientApi from "../../services/clientApi";

export default function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [analytics, setAnalytics] = useState(null);
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState(
    searchParams.get("client") || ""
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    const fromUrl = searchParams.get("client") || "";
    if (fromUrl !== clientId) {
      setClientId(fromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    loadAnalytics(clientId);
  }, [clientId]);

  async function loadClients() {
    try {
      const res = await clientApi.getAll();
      setClients(res.clients || []);
    } catch (err) {
    }
  }

  async function loadAnalytics(selectedClientId = "") {
    try {
      setLoading(true);
      const res = await getAnalytics(selectedClientId || null);
      setAnalytics(res.data.analytics || {});
    } catch (err) {
      setAnalytics({});
    } finally {
      setLoading(false);
    }
  }

  function handleClientChange(value) {
    setClientId(value);
    if (value) {
      setSearchParams({ client: value });
    } else {
      setSearchParams({});
    }
  }

  const selectedClient = clients.find(
    (c) => String(c.id) === String(clientId)
  );

  const totalInvoices = Number(analytics?.totalInvoices || 0);
  const totalRevenue = Number(analytics?.totalRevenue || 0);
  const totalVAT = Number(analytics?.totalVAT || 0);
  const monthlyInvoices = Number(analytics?.monthlyInvoices || 0);

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl font-bold text-slate-800">
          Analytics Dashboard
        </h1>
        <p className="text-slate-500 mt-2">
          {selectedClient
            ? `Analytics for ${selectedClient.company_name}`
            : "Monitor your invoices and business performance."}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="md:w-72">
          <label className="block mb-2 text-sm font-semibold text-black">
            Select Client
          </label>
          <select
            value={clientId}
            onChange={(e) => handleClientChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-black"
          >
            <option value="">All Clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.company_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl p-10 shadow text-slate-500">
          Loading analytics...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <AnalyticsCard
              title="Total Invoices"
              value={totalInvoices}
              icon={<FileText size={24} />}
              color="blue"
            />

            <AnalyticsCard
              title="Total Revenue"
              value={`AED ${totalRevenue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              icon={<DollarSign size={24} />}
              color="green"
            />

            <AnalyticsCard
              title="VAT"
              value={`AED ${totalVAT.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              icon={<Receipt size={24} />}
              color="orange"
            />

            <AnalyticsCard
              title="This Month"
              value={monthlyInvoices}
              icon={<Calendar size={24} />}
              color="purple"
            />
          </div>

          {selectedClient && (
            <div className="bg-white rounded-3xl border shadow-sm p-8">
              <h2 className="text-xl font-semibold text-black mb-4">
                {selectedClient.company_name} Summary
              </h2>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="rounded-2xl bg-blue-50 p-6">
                  <p className="text-sm text-blue-700 font-medium">
                    Total Invoices
                  </p>
                  <p className="text-3xl font-bold text-blue-900 mt-2">
                    {totalInvoices}
                  </p>
                </div>
                <div className="rounded-2xl bg-green-50 p-6">
                  <p className="text-sm text-green-700 font-medium">
                    Total Revenue
                  </p>
                  <p className="text-3xl font-bold text-green-900 mt-2">
                    AED{" "}
                    {totalRevenue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}

function AnalyticsCard({ title, value, icon, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <div className="bg-white rounded-3xl border shadow-sm p-6 hover:shadow-lg transition">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-sm">
            {title}
          </p>
          <h2 className="text-3xl font-bold mt-3 text-black">
            {value}
          </h2>
        </div>
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colors[color]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
