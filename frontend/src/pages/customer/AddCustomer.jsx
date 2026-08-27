import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import customerApi from "../../services/customerApi";
import PartyForm from "../../components/party/PartyForm";
import { buildInitialValues } from "../../constants/partyFields";

// Mirrors the new Zoho-parity billing fields onto the legacy
// country/city/address/contact_person columns the rest of the app (the
// Customers list, CustomerDetail header, dashboard/analytics reads) still
// relies on. The backend does not do this mapping itself — customerService
// treats billing_* and the legacy columns as fully independent fields — so
// without this the legacy columns would stay blank for every customer
// created through the new sectioned form.
function withLegacyMirrors(form) {
  const contactPerson = [form.primary_contact_first_name, form.primary_contact_last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    ...form,
    country: form.billing_country || "",
    city: form.billing_city || "",
    address: [form.billing_address_line1, form.billing_address_line2].filter(Boolean).join(", "),
    contact_person: contactPerson,
  };
}

export default function AddCustomer() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [saving, setSaving] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(isEditMode);
  const [initialValues, setInitialValues] = useState(() => buildInitialValues("customer"));

  useEffect(() => {
    if (!isEditMode) return;

    async function loadCustomer() {
      try {
        const res = await customerApi.get(id);
        const customer = res.customer || {};

        setInitialValues({
          ...buildInitialValues("customer"),
          ...customer,
          portal_access: Boolean(customer.portal_access),
        });
      } catch (err) {
        toast.error(err.response?.data?.error || "Unable to load customer.");
        navigate("/dashboard/customers");
      } finally {
        setLoadingCustomer(false);
      }
    }

    loadCustomer();
  }, [id, isEditMode, navigate]);

  async function handleSubmit(form) {
    const payload = withLegacyMirrors(form);

    try {
      setSaving(true);

      if (isEditMode) {
        await customerApi.update(id, payload);
        toast.success("Customer updated successfully.");
        navigate(`/dashboard/customers/${id}`);
      } else {
        const res = await customerApi.create(payload);
        toast.success("Customer added successfully.");
        navigate(`/dashboard/customers/${res?.customer?.id}`);
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          `Unable to ${isEditMode ? "update" : "create"} customer.`
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadingCustomer) {
    return (
      <div className="max-w-6xl mx-auto text-slate-500">
        Loading customer...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {isEditMode ? "Edit Customer" : "Add New Customer"}
          </h1>

          <p className="text-slate-500 mt-2">
            {isEditMode
              ? "Update this customer's details."
              : "Create a customer before uploading invoices."}
          </p>
        </div>

        <button
          onClick={() => navigate("/dashboard/customers")}
          className="px-5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
        >
          Back
        </button>
      </div>

      <PartyForm
        entityType="customer"
        initialValues={initialValues}
        onSubmit={handleSubmit}
        submitting={saving}
        submitLabel={isEditMode ? "Update Customer" : "Save Customer"}
      />
    </div>
  );
}
