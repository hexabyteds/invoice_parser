import { useState } from "react";
import { useNavigate } from "react-router-dom";
import clientApi from "../services/clientApi";

export default function AddClient() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

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

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.company_name.trim()) {
      alert("Company Name is required.");
      return;
    }

    try {
      setLoading(true);

      console.log("form", form);
      const res = await clientApi.create(form);

      
      // alert("Client added successfully.");

      console.log("res", res?.client?.id);

      navigate(`/dashboard/clients/${res?.client?.id}`);
    } catch (err) {
      // alert(
      //   err.response?.data?.error ||
      //     "Unable to create client."
      // );
      console.log("error", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">

      <div className="flex items-center justify-between mb-8">

        <div>

          <h1 className="text-3xl font-bold text-white">
            Add New Client
          </h1>

          <p className="text-slate-400 mt-2">
            Create a client before uploading invoices.
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
            />

            <Input
              label="Contact Person"
              name="contact_person"
              value={form.contact_person}
              onChange={handleChange}
            />

            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
            />

            <Input
              label="Phone"
              name="phone"
              value={form.phone}
              onChange={handleChange}
            />

            <Input
              label="Country"
              name="country"
              value={form.country}
              onChange={handleChange}
            />

            <Input
              label="City"
              name="city"
              value={form.city}
              onChange={handleChange}
            />

            <Input
              label="TRN"
              name="trn"
              value={form.trn}
              onChange={handleChange}
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
              {loading ? "Saving..." : "Save Client"}
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
  ...props
}) {
  return (
    <div>

      <label className="text-sm text-slate-300">
        {label}
      </label>

      <input
        {...props}
        className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-white outline-none focus:border-blue-500"
      />

    </div>
  );
}