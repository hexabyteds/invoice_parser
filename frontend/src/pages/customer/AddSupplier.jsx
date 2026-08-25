import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import supplierApi from "../../services/supplierApi";
import PartyForm from "../../components/party/PartyForm";
import { buildInitialValues } from "../../constants/partyFields";

export default function AddSupplier() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [saving, setSaving] = useState(false);
  const [loadingSupplier, setLoadingSupplier] = useState(isEditMode);
  const [initialValues, setInitialValues] = useState(() => buildInitialValues("supplier"));

  useEffect(() => {
    if (!isEditMode) return;

    async function loadSupplier() {
      try {
        const res = await supplierApi.get(id);
        const supplier = res.supplier || {};

        setInitialValues({
          ...buildInitialValues("supplier"),
          ...supplier,
        });
      } catch (err) {
        toast.error(err.response?.data?.error || "Unable to load supplier.");
        navigate("/dashboard/suppliers");
      } finally {
        setLoadingSupplier(false);
      }
    }

    loadSupplier();
  }, [id, isEditMode, navigate]);

  async function handleSubmit(form) {
    try {
      setSaving(true);

      if (isEditMode) {
        await supplierApi.update(id, form);
        toast.success("Supplier updated successfully.");
        navigate(`/dashboard/suppliers/${id}`);
      } else {
        const res = await supplierApi.create(form);
        toast.success("Supplier added successfully.");
        navigate(`/dashboard/suppliers/${res?.supplier?.id}`);
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          `Unable to ${isEditMode ? "update" : "create"} supplier.`
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadingSupplier) {
    return (
      <div className="max-w-6xl mx-auto text-slate-500">
        Loading supplier...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {isEditMode ? "Edit Supplier" : "Add New Supplier"}
          </h1>

          <p className="text-slate-500 mt-2">
            {isEditMode
              ? "Update this supplier's details."
              : "Add a supplier to your vendor address book."}
          </p>
        </div>

        <button
          onClick={() => navigate("/dashboard/suppliers")}
          className="px-5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
        >
          Back
        </button>
      </div>

      <PartyForm
        entityType="supplier"
        initialValues={initialValues}
        onSubmit={handleSubmit}
        submitting={saving}
        submitLabel={isEditMode ? "Update Supplier" : "Save Supplier"}
      />
    </div>
  );
}
