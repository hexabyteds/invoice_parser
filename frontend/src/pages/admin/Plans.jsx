import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  CheckCircle,
  XCircle,
  Star,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import AdminPageShell from "../../components/admin/AdminPageShell";
import PlanModal from "../../components/admin/PlanModal";
import DeletePlanModal from "../../components/admin/DeletePlanModal";
import planApi from "../../services/planApi";

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deletePlan, setDeletePlan] = useState(null);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const data = await planApi.getAll();
      setPlans(data.plans || []);
    } catch (error) {
      toast.error(error.response?.data?.error || "Unable to load plans.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const filteredPlans = useMemo(() => {
    const keyword = search.toLowerCase();

    return plans.filter(
      (plan) =>
        plan.name.toLowerCase().includes(keyword) ||
        plan.slug.toLowerCase().includes(keyword)
    );
  }, [plans, search]);

  const handleAdd = () => {
    setSelectedPlan(null);
    setOpenModal(true);
  };

  const handleEdit = (plan) => {
    setSelectedPlan(plan);
    setOpenModal(true);
  };

  const handleDelete = (plan) => {
    setDeletePlan(plan);
    setDeleteModal(true);
  };

  const toggleStatus = async (plan) => {
    try {
      await planApi.changeStatus(plan.id, !plan.active);
      toast.success("Plan status updated.");
      loadPlans();
    } catch (error) {
      toast.error(error.response?.data?.error || "Unable to update plan.");
    }
  };

  return (
    <AdminPageShell
      title="Subscription Plans"
      description="Manage pricing, limits, and plan features."
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search
            size={18}
            className="absolute left-4 top-3.5 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plans..."
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={handleAdd}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={18} />
          Add Plan
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 text-left font-medium">Plan</th>
                <th className="px-4 py-4 text-left font-medium">Monthly</th>
                <th className="px-4 py-4 text-left font-medium">Yearly</th>
                <th className="px-4 py-4 text-left font-medium">Invoices</th>
                <th className="px-4 py-4 text-left font-medium">Customers</th>
                <th className="px-4 py-4 text-left font-medium">Users</th>
                <th className="px-4 py-4 text-left font-medium">Status</th>
                <th className="px-4 py-4 text-left font-medium">Featured</th>
                <th className="px-6 py-4 text-center font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-500">
                    <Loader2 className="mx-auto animate-spin" size={28} />
                  </td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-500">
                    No plans found.
                  </td>
                </tr>
              ) : (
                filteredPlans.map((plan) => (
                  <tr
                    key={plan.id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-6 py-5">
                      <div className="font-semibold text-slate-900">
                        {plan.name}
                      </div>
                      <div className="text-xs text-slate-500">{plan.slug}</div>
                    </td>

                    <td className="px-4 py-5 text-slate-700">
                      AED {Number(plan.monthly_price).toFixed(2)}
                    </td>

                    <td className="px-4 py-5 text-slate-700">
                      AED {Number(plan.yearly_price).toFixed(2)}
                    </td>

                    <td className="px-4 py-5 text-slate-700">
                      {plan.invoice_limit}
                    </td>

                    <td className="px-4 py-5 text-slate-700">
                      {plan.customer_limit}
                    </td>

                    <td className="px-4 py-5 text-slate-700">
                      {plan.user_limit}
                    </td>

                    <td className="px-4 py-5">
                      {plan.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                          <CheckCircle size={15} />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-red-600">
                          <XCircle size={15} />
                          Disabled
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-5">
                      {plan.featured ? (
                        <Star
                          size={18}
                          className="fill-amber-400 text-amber-400"
                        />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEdit(plan)}
                          className="rounded-lg p-2 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700"
                          title="Edit plan"
                        >
                          <Pencil size={18} />
                        </button>

                        <button
                          onClick={() => toggleStatus(plan)}
                          className="rounded-lg p-2 text-slate-600 hover:bg-amber-100 hover:text-amber-700"
                          title={plan.active ? "Disable plan" : "Enable plan"}
                        >
                          {plan.active ? (
                            <XCircle size={18} />
                          ) : (
                            <CheckCircle size={18} />
                          )}
                        </button>

                        <button
                          onClick={() => handleDelete(plan)}
                          className="rounded-lg p-2 text-slate-600 hover:bg-red-100 hover:text-red-700"
                          title="Delete plan"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PlanModal
        open={openModal}
        plan={selectedPlan}
        onClose={() => setOpenModal(false)}
        onSaved={loadPlans}
      />

      <DeletePlanModal
        open={deleteModal}
        plan={deletePlan}
        onClose={() => setDeleteModal(false)}
        onDeleted={loadPlans}
      />
    </AdminPageShell>
  );
}
