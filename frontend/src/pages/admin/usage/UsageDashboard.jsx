import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import AdminPageShell from "../../../components/admin/AdminPageShell";
import SummaryCards from "../../../components/admin/usage/SummaryCards";
import UsageFilters from "../../../components/admin/usage/UsageFilters";
import UsageTable from "../../../components/admin/usage/UsageTable";
import UsageDetailsModal from "../../../components/admin/usage/UsageDetailsModal";
import { getDashboard } from "../../../services/adminUsageApi";

export default function UsageDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      const res = await getDashboard();
      setSummary(res.data.dashboard.summary || {});
      setCustomers(res.data.dashboard.customers || []);
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Failed to load usage dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  const plans = useMemo(() => {
    const unique = [
      ...new Set(
        customers
          .map((customer) => customer.plan_name)
          .filter(Boolean)
      ),
    ];
    return unique.sort();
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const keyword = search.toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        customer.name?.toLowerCase().includes(keyword) ||
        customer.email?.toLowerCase().includes(keyword) ||
        customer.company_name?.toLowerCase().includes(keyword);

      const matchesPlan =
        planFilter === "all" ||
        String(customer.plan_name).toLowerCase() === planFilter.toLowerCase();

      return matchesSearch && matchesPlan;
    });
  }, [customers, search, planFilter]);

  if (loading) {
    return (
      <AdminPageShell
        title="Usage"
        description="Monitor customer plan usage across the platform."
      >
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
          <p className="mt-4 font-medium text-slate-700">
            Loading usage dashboard...
          </p>
        </div>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      title="Usage"
      description="Monitor customer plan usage across the platform."
    >
      <SummaryCards summary={summary} />

      <div className="space-y-4">
        <UsageFilters
          search={search}
          onSearchChange={setSearch}
          planFilter={planFilter}
          onPlanFilterChange={setPlanFilter}
          plans={plans}
        />

        <UsageTable
          customers={filteredCustomers}
          onViewCustomer={setSelectedCustomer}
        />
      </div>

      <UsageDetailsModal
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
      />
    </AdminPageShell>
  );
}
