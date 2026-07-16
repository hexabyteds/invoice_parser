import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import { getInvoice, updateInvoice } from "../services/invoiceApi";

const emptyItem = {
  description: "",
  quantity: 1,
  unit_price: 0,
  total_price: 0,
};

export default function EditInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInvoice() {
      try {
        const res = await getInvoice(id);
        const invoice = res.data.invoice || {};

        setForm({
          invoice_no: invoice.invoice_no || "",
          client_name: invoice.client_name || "",
          invoice_date: toDateInput(invoice.invoice_date),
          due_date: toDateInput(invoice.due_date),
          currency: invoice.currency || "AED",
          trn: invoice.trn || "",
          phone_number: invoice.phone_number || invoice.phoneNumber || "",
          location: invoice.location || "",
          subtotal: Number(invoice.subtotal) || 0,
          vat_rate: Number(invoice.vat_rate) || 0,
          vat_amount: Number(invoice.vat_amount) || 0,
          total_amount: Number(invoice.total_amount) || 0,
        });

        setLineItems(
          (res.data.lineItems || []).map((item) => ({
            description: item.description || "",
            quantity: Number(item.quantity) || 0,
            unit_price: Number(item.unit_price) || 0,
            total_price: Number(item.total_price) || 0,
          }))
        );
      } catch (err) {
        console.error(err);
        setError(
          err.response?.data?.error || "Unable to load invoice."
        );
      } finally {
        setLoading(false);
      }
    }

    loadInvoice();
  }, [id]);

  // Derived totals from the current line items + VAT rate
  const computed = useMemo(() => {
    const subtotal = lineItems.reduce(
      (sum, item) => sum + Number(item.total_price || 0),
      0
    );
    const vatRate = Number(form?.vat_rate || 0);
    const vatAmount = (subtotal * vatRate) / 100;

    return {
      subtotal,
      vatAmount,
      total: subtotal + vatAmount,
    };
  }, [lineItems, form?.vat_rate]);

  function handleField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleItemChange(index, field, value) {
    setLineItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };

      // Auto-calculate the row total from qty * unit price
      if (field === "quantity" || field === "unit_price") {
        const qty = Number(field === "quantity" ? value : item.quantity) || 0;
        const price =
          Number(field === "unit_price" ? value : item.unit_price) || 0;
        item.total_price = Number((qty * price).toFixed(2));
      }

      next[index] = item;
      return next;
    });
  }

  function addItem() {
    setLineItems((prev) => [...prev, { ...emptyItem }]);
  }

  function removeItem(index) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      const payload = {
        ...form,
        // Keep stored totals in sync with the line items
        subtotal: computed.subtotal,
        vat_amount: computed.vatAmount,
        total_amount: computed.total,
        lineItems,
      };

      await updateInvoice(id, payload);

      navigate(`/dashboard/invoices/${id}`);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Unable to save invoice."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow border p-10 flex flex-col items-center text-slate-500">
        <Loader2 size={36} className="animate-spin text-blue-600" />
        <p className="mt-4">Loading invoice...</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-red-600">
        {error || "Invoice not found."}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-blue-600 mb-4 hover:underline"
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <h1 className="text-3xl font-bold text-black">Edit Invoice</h1>
          <p className="text-slate-500 mt-2">
            Update the invoice details and line items.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-60 transition"
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Save size={18} />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          {error}
        </div>
      )}

      {/* Invoice info */}
      <div className="bg-white rounded-3xl shadow border p-8">
        <h2 className="text-xl font-semibold mb-6 text-black">
          Invoice Information
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Field
            label="Invoice Number"
            value={form.invoice_no}
            onChange={(v) => handleField("invoice_no", v)}
          />
          <Field
            label="Client"
            value={form.client_name}
            onChange={(v) => handleField("client_name", v)}
          />
          <Field
            label="Invoice Date"
            type="date"
            value={form.invoice_date}
            onChange={(v) => handleField("invoice_date", v)}
          />
          <Field
            label="Due Date"
            type="date"
            value={form.due_date}
            onChange={(v) => handleField("due_date", v)}
          />
          <Field
            label="Currency"
            value={form.currency}
            onChange={(v) => handleField("currency", v)}
          />
          <Field
            label="TRN"
            value={form.trn}
            onChange={(v) => handleField("trn", v)}
          />
          <Field
            label="Phone"
            value={form.phone_number}
            onChange={(v) => handleField("phone_number", v)}
          />
          <Field
            label="Location"
            value={form.location}
            onChange={(v) => handleField("location", v)}
          />
          <Field
            label="VAT Rate (%)"
            type="number"
            value={form.vat_rate}
            onChange={(v) => handleField("vat_rate", v)}
          />
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-3xl shadow border overflow-hidden">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold text-black">
            Line Items ({lineItems.length})
          </h2>

          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold transition"
          >
            <Plus size={16} />
            Add Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-4 text-black">Description</th>
                <th className="text-center px-6 py-4 text-black w-28">Qty</th>
                <th className="text-right px-6 py-4 text-black w-40">
                  Unit Price
                </th>
                <th className="text-right px-6 py-4 text-black w-40">Total</th>
                <th className="px-6 py-4 w-16"></th>
              </tr>
            </thead>

            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-slate-400"
                  >
                    No line items. Click "Add Item" to create one.
                  </td>
                </tr>
              ) : (
                lineItems.map((item, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-6 py-3">
                      <input
                        value={item.description}
                        onChange={(e) =>
                          handleItemChange(index, "description", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-black outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(index, "quantity", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-black text-center outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) =>
                          handleItemChange(index, "unit_price", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-black text-right outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-black">
                      {Number(item.total_price).toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-red-100 text-red-600 inline-flex items-center justify-center transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial summary (auto-calculated) */}
      <div className="bg-white rounded-3xl shadow border p-8">
        <h2 className="text-xl font-semibold mb-6 text-black">
          Financial Summary
        </h2>

        <div className="grid md:grid-cols-3 gap-5">
          <SummaryCard
            title="Subtotal"
            value={computed.subtotal}
            currency={form.currency}
          />
          <SummaryCard
            title={`VAT (${Number(form.vat_rate) || 0}%)`}
            value={computed.vatAmount}
            currency={form.currency}
          />
          <SummaryCard
            title="Total"
            value={computed.total}
            currency={form.currency}
            highlight
          />
        </div>
      </div>

    </form>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <div className="border rounded-2xl p-5">
      <label className="block text-sm font-medium text-blue-600 mb-2">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
      />
    </div>
  );
}

function SummaryCard({ title, value, currency, highlight }) {
  return (
    <div
      className={`rounded-2xl p-5 border ${
        highlight ? "bg-blue-50 border-blue-200" : "bg-slate-50"
      }`}
    >
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-slate-800">
        {currency} {Number(value).toFixed(2)}
      </div>
    </div>
  );
}

function toDateInput(date) {
  if (!date) return "";

  const d = new Date(date);
  if (isNaN(d)) return "";

  return d.toISOString().split("T")[0];
}
