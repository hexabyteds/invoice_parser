import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import clientApi from "../../services/clientApi";

export default function AddClient() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [loadingClient, setLoadingClient] = useState(isEditMode);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    company_name: "",
    contact_person: "",
    email: "",
    phone: "",
    country: "",
    city: "",
    trn: "",
    address: "",
    notes: "",
  });

  useEffect(() => {
    if (!isEditMode) return;

    async function loadClient() {
      try {
        const res = await clientApi.get(id);
        const client = res.client || {};

        setForm({
          company_name: client.company_name || "",
          contact_person: client.contact_person || "",
          email: client.email || "",
          phone: client.phone || "",
          country: client.country || "",
          city: client.city || "",
          trn: client.trn || "",
          address: client.address || "",
          notes: client.notes || "",
        });
      } catch (err) {
        toast.error(err.response?.data?.error || "Unable to load client.");
        navigate("/dashboard/clients");
      } finally {
        setLoadingClient(false);
      }
    }

    loadClient();
  }, [id, isEditMode, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm({
      ...form,
      [name]: value,
    });

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_PATTERN = /^[0-9+\-\s()]{7,20}$/;
  const TRN_PATTERN = /^[0-9]+$/;

  function validate() {
    const nextErrors = {};

    if (!form.company_name.trim()) {
      nextErrors.company_name = "Company Name is required.";
    }

    if (!form.contact_person.trim()) {
      nextErrors.contact_person = "Contact Person is required.";
    }

    if (!form.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(form.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!form.phone.trim()) {
      nextErrors.phone = "Phone is required.";
    } else if (!PHONE_PATTERN.test(form.phone.trim())) {
      nextErrors.phone = "Enter a valid phone number.";
    }

    if (!form.country.trim()) {
      nextErrors.country = "Country is required.";
    }

    if (!form.city.trim()) {
      nextErrors.city = "City is required.";
    }

    if (!form.trn.trim()) {
      nextErrors.trn = "TRN is required.";
    } else if (!TRN_PATTERN.test(form.trn.trim())) {
      nextErrors.trn = "TRN must contain digits only.";
    }

    return nextErrors;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nextErrors = validate();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    try {
      setLoading(true);

      if (isEditMode) {
        await clientApi.update(id, form);
        toast.success("Client updated successfully.");
        navigate(`/dashboard/clients/${id}`);
      } else {
        const res = await clientApi.create(form);
        toast.success("Client added successfully.");
        navigate(`/dashboard/clients/${res?.client?.id}`);
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          `Unable to ${isEditMode ? "update" : "create"} client.`
      );
    } finally {
      setLoading(false);
    }
  };

  if (loadingClient) {
    return (
      <div className="max-w-6xl mx-auto text-slate-400">
        Loading client...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">

      <div className="flex items-center justify-between mb-8">

        <div>

          <h1 className="text-3xl font-bold text-slate-900">
            {isEditMode ? "Edit Client" : "Add New Client"}
          </h1>

          <p className="text-slate-400 mt-2">
            {isEditMode
              ? "Update this client's details."
              : "Create a client before uploading invoices."}
          </p>

        </div>

        <button
          onClick={() => navigate("/dashboard/clients")}
          className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700"
        >
          Back
        </button>

      </div>

      <div className="grid lg:grid-cols-3 gap-8">

        {/* FORM */}

        <form
          onSubmit={handleSubmit}
          noValidate
          className="lg:col-span-2 bg-slate-900 rounded-2xl p-8 border border-slate-800"
        >

          <h2 className="text-xl font-semibold mb-6">
            Company Information
          </h2>

          <div className="grid md:grid-cols-2 gap-5">

            <Input
              label="Company Name *"
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              error={errors.company_name}
              required
            />

            <Input
              label="Contact Person *"
              name="contact_person"
              value={form.contact_person}
              onChange={handleChange}
              error={errors.contact_person}
              required
            />

            <Input
              label="Email *"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              required
            />

            <Input
              label="Phone *"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              error={errors.phone}
              required
            />

            <Input
              label="Country *"
              name="country"
              value={form.country}
              onChange={handleChange}
              error={errors.country}
              required
            />

            <Input
              label="City *"
              name="city"
              value={form.city}
              onChange={handleChange}
              error={errors.city}
              required
            />

            <Input
              label="TRN *"
              name="trn"
              value={form.trn}
              onChange={handleChange}
              error={errors.trn}
              required
            />

          </div>

          <div className="mt-5">

            <label className="text-sm text-slate-300">
              Address
            </label>

            <textarea
              rows={3}
              name="address"
              value={form.address}
              onChange={handleChange}
              className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-white outline-none focus:border-blue-500"
            />

          </div>

          <div className="mt-5">

            <label className="text-sm text-slate-300">
              Notes
            </label>

            <textarea
              rows={4}
              name="notes"
              value={form.notes}
              onChange={handleChange}
              className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-white outline-none focus:border-blue-500"
            />

          </div>

          <div className="flex justify-end gap-4 mt-8">

            <button
              type="button"
              onClick={() => navigate("/dashboard/clients")}
              className="px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600"
            >
              Cancel
            </button>

            <button
              disabled={loading}
              className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
            >
              {loading
                ? "Saving..."
                : isEditMode
                  ? "Update Client"
                  : "Save Client"}
            </button>

          </div>

        </form>

        {/* PREVIEW */}

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 h-fit sticky top-8">

          <h2 className="text-xl font-semibold mb-6">
            Live Preview
          </h2>

          <div className="space-y-4">

            <div>

              <p className="text-slate-500 text-sm">
                Company
              </p>

              <p className="font-semibold text-lg">
                {form.company_name || "Company Name"}
              </p>

            </div>

            <div>

              <p className="text-slate-500 text-sm">
                Contact
              </p>

              <p>
                {form.contact_person || "-"}
              </p>

            </div>

            <div>

              <p className="text-slate-500 text-sm">
                Email
              </p>

              <p>
                {form.email || "-"}
              </p>

            </div>

            <div>

              <p className="text-slate-500 text-sm">
                Phone
              </p>

              <p>
                {form.phone || "-"}
              </p>

            </div>

            <div>

              <p className="text-slate-500 text-sm">
                Country
              </p>

              <p>
                {form.country || "-"}
              </p>

            </div>

            <div>

              <p className="text-slate-500 text-sm">
                City
              </p>

              <p>
                {form.city || "-"}
              </p>

            </div>

            <div>

              <p className="text-slate-500 text-sm">
                TRN
              </p>

              <p>
                {form.trn || "-"}
              </p>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

function Input({
  label,
  error,
  ...props
}) {
  return (
    <div>

      <label className="text-sm text-slate-300">
        {label}
      </label>

      <input
        {...props}
        className={`mt-2 w-full rounded-xl bg-slate-950 border px-4 py-3 text-white outline-none focus:border-blue-500 ${
          error ? "border-red-500" : "border-slate-700"
        }`}
      />

      {error && (
        <p className="mt-1.5 text-sm text-red-400">
          {error}
        </p>
      )}

    </div>
  );
}