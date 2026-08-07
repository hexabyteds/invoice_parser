import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import { getInvoice, getInvoiceSource, updateInvoice } from "../../services/invoiceApi";
import { DOCUMENT_TYPES } from "../../utils/documentTypes";

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
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const savedTimeoutRef = useRef(null);

  useEffect(() => {
    return () => clearTimeout(savedTimeoutRef.current);
  }, []);
  const [hasSource, setHasSource] = useState(false);
  const [sourceUrl, setSourceUrl] = useState(null);
  const [sourceKind, setSourceKind] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  useEffect(() => {
    async function loadInvoice() {
      try {
        const res = await getInvoice(id);
        const invoice = res.data.invoice || {};

        setHasSource(Boolean(invoice.hasSourceFile || invoice.image_path));

        setForm({
          invoice_no: invoice.invoice_no || "",
          document_type: invoice.document_type || "",
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
        setError(
          err.response?.data?.error || "Unable to load invoice."
        );
      } finally {
        setLoading(false);
      }
    }

    loadInvoice();
  }, [id]);

  useEffect(() => {
    let objectUrl;

    async function loadSource() {
      if (!hasSource) {
        setSourceUrl(null);
        setSourceKind(null);
        return;
      }

      setSourceLoading(true);
      try {
        const res = await getInvoiceSource(id);
        const blob = res.data;
        objectUrl = URL.createObjectURL(blob);
        setSourceUrl(objectUrl);
        setSourceKind((blob.type || "").includes("pdf") ? "pdf" : "image");
      } catch {
        setSourceUrl(null);
        setSourceKind(null);
      } finally {
        setSourceLoading(false);
      }
    }

    loadSource();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [id, hasSource]);

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

      // setTimeout(async () => {
        setSaving(true);
      // }, 1000);

      // setSaving(true);
      // setSaved(false);
      setError("");
      clearTimeout(savedTimeoutRef.current);

      const payload = {
        ...form,
        // Keep stored totals in sync with the line items
        subtotal: computed.subtotal,
        vat_amount: computed.vatAmount,
        total_amount: computed.total,
        lineItems,
      };

      await updateInvoice(id, payload, { timeout: 10000 });

      // savedTimeoutRef.current = setTimeout(() => setSaved(true), 10000);

      // navigate(`/dashboard/invoices/${id}`);
    } catch (err) {
      const timedOut =
        err.code === "ECONNABORTED" ||
        /timeout/i.test(err.message || "");

      setError(
        timedOut
          ? "Save timed out. Please try again."
          : err.response?.data?.error || "Unable to save invoice."
      );
    } finally {
      setTimeout(() => {
        setSaving(false);
      }, 1000);
      // setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow border p-10 flex flex-col items-center text-slate-500">
        <Loader2 size={36} className="animate-spin text-indigo-600" />
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
            className="flex items-center gap-2 text-indigo-600 mb-4 hover:underline"
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <h1 className="text-3xl font-bold text-black">Edit Invoice</h1>
          <p className="text-slate-500 mt-2">
            Update the Document details and line items.
          </p>
        </div>

      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          {error}
        </div>
      )}

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700">
          Invoice saved.
        </div>
      )}

      {/* Document Details + Line Items (left) paired with the original
          document preview (right), matching the spreadsheet-style form
          used on the read-only invoice detail view — but editable. */}
      <div className="grid lg:grid-cols-3 gap-6 items-start">

        <div className="lg:col-span-2 bg-white rounded-2xl shadow border overflow-hidden">

          <div className="border-b bg-slate-50 px-6 py-4">
            <h2 className="text-lg font-bold text-black">Document Details</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse table-fixed">
              <colgroup>
                <col className="w-[17%]" />
                <col className="w-[33%]" />
                <col className="w-[17%]" />
                <col className="w-[33%]" />
              </colgroup>
              <tbody>
                <tr className="border-b">
                  <EditCell label="Document No">
                    <input
                      value={form.invoice_no}
                      onChange={(e) => handleField("invoice_no", e.target.value)}
                      className={inputClass}
                    />
                  </EditCell>
                  <StaticCell
                    label="Amount Exc. VAT"
                    value={money(computed.subtotal, form.currency)}
                    isLast
                  />
                </tr>

                <tr className="border-b">
                  <EditCell label="Document Date">
                    <input
                      type="date"
                      value={form.invoice_date}
                      onChange={(e) => handleField("invoice_date", e.target.value)}
                      className={inputClass}
                    />
                  </EditCell>
                  <StaticCell
                    label="VAT Amount"
                    value={money(computed.vatAmount, form.currency)}
                    isLast
                  />
                </tr>

                <tr className="border-b">
                  <EditCell label="Document Type">
                    <select
                      value={form.document_type}
                      onChange={(e) => handleField("document_type", e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Not set</option>
                      {DOCUMENT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </EditCell>
                  <StaticCell
                    label="Amount Inc. VAT"
                    value={money(computed.total, form.currency)}
                    isLast
                  />
                </tr>

                <tr className="border-b">
                  <EditCell label="Due Date">
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => handleField("due_date", e.target.value)}
                      className={inputClass}
                    />
                  </EditCell>
                  <EditCell label="Currency" isLast>
                    <input
                      value={form.currency}
                      onChange={(e) => handleField("currency", e.target.value)}
                      className={inputClass}
                    />
                  </EditCell>
                </tr>

                <tr className="border-b">
                  <EditCell label="Client">
                    <input
                      value={form.client_name}
                      onChange={(e) => handleField("client_name", e.target.value)}
                      className={inputClass}
                    />
                  </EditCell>
                  <EditCell label="TRN Number" isLast>
                    <input
                      value={form.trn}
                      onChange={(e) => handleField("trn", e.target.value)}
                      className={inputClass}
                    />
                  </EditCell>
                </tr>

                <tr className="border-b">
                  <EditCell label="Phone">
                    <input
                      value={form.phone_number}
                      onChange={(e) => handleField("phone_number", e.target.value)}
                      className={inputClass}
                    />
                  </EditCell>
                  <EditCell label="VAT Rate (%)" isLast>
                    <input
                      type="number"
                      value={form.vat_rate}
                      onChange={(e) => handleField("vat_rate", e.target.value)}
                      className={inputClass}
                    />
                  </EditCell>
                </tr>

                <tr>
                  <EditCell label="Location">
                    <input
                      value={form.location}
                      onChange={(e) => handleField("location", e.target.value)}
                      className={inputClass}
                    />
                  </EditCell>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="border-t px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-black">
              Line Items ({lineItems.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addItem}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold transition"
              >
                <Plus size={16} />
                Add Item
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold disabled:opacity-60 transition"
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>

          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-y-[3px] border-double border-slate-800 bg-slate-50">
                  <th className="text-left px-6 py-3 text-black font-bold">Description</th>
                  <th className="text-center px-6 py-3 text-black font-bold w-28">Qty</th>
                  <th className="text-right px-6 py-3 text-black font-bold w-40">
                    Unit Price
                  </th>
                  <th className="text-right px-6 py-3 text-black font-bold w-32">
                    Amount Exc. VAT
                  </th>
                  <th className="text-right px-6 py-3 text-black font-bold w-28">VAT</th>
                  <th className="text-right px-6 py-3 text-black font-bold w-32">
                    Amount Inc. VAT
                  </th>
                  <th className="px-6 py-3 w-16"></th>
                </tr>
              </thead>

              <tbody>
                {lineItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-slate-400"
                    >
                      No line items. Click "Add Item" to create one.
                    </td>
                  </tr>
                ) : (
                  lineItems.map((item, index) => {
                    // Mirrors the read-only invoice detail view: line items
                    // don't store their own VAT split, so VAT and the
                    // inclusive total are derived from the invoice's overall
                    // VAT rate applied to this line's pre-tax amount.
                    const vatRate = Number(form.vat_rate) || 0;
                    const withoutVat = Number(item.total_price) || 0;
                    const vatAmount = withoutVat * (vatRate / 100);
                    const totalPrice = withoutVat + vatAmount;

                    return (
                      <tr key={index} className="border-t">
                        <td className="px-6 py-3">
                          <input
                            value={item.description}
                            onChange={(e) =>
                              handleItemChange(index, "description", e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-black outline-none focus:ring-2 focus:ring-indigo-500"
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
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-black text-center outline-none focus:ring-2 focus:ring-indigo-500"
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
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-black text-right outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-6 py-3 text-right text-black">
                          {withoutVat.toFixed(2)}
                         
                        </td>
                        <td className="px-6 py-3 text-right text-black">
                          {vatAmount.toFixed(2)}
                        </td>
                        <td className="px-6 py-3 text-right font-semibold text-black">
                        {totalPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-200 rounded-2xl shadow border p-6 lg:sticky lg:top-8">
          <h2 className="text-lg font-bold text-black text-center mb-4">
            Invoice View
          </h2>

          {sourceLoading && (
            <p className="text-slate-500 text-center">Loading document...</p>
          )}

          {!sourceLoading && sourceUrl && sourceKind === "image" && (
            <img
              src={sourceUrl}
              alt="Uploaded invoice"
              className="max-w-full rounded-xl border mx-auto"
            />
          )}

          {!sourceLoading && sourceUrl && sourceKind === "pdf" && (
            <iframe
              title="Uploaded invoice PDF"
              src={`${sourceUrl}#toolbar=0&navpanes=0`}
              className="w-full h-[600px] rounded-xl border"
            />
          )}

          {!sourceLoading && !sourceUrl && (
            <p className="text-slate-500 text-center">
              {hasSource
                ? "Original file is not available on the server."
                : "No source file was uploaded for this document."}
            </p>
          )}
        </div>

      </div>

    </form>
  );
}

function EditCell({ label, children, isLast = false }) {
  return (
    <>
      <td className="px-3 py-3 text-slate-500 font-medium bg-slate-50/60 border-r align-top">
        {label}
      </td>
      <td className={`px-3 py-3 align-top ${isLast ? "" : "border-r"}`}>
        {children}
      </td>
    </>
  );
}

function StaticCell({ label, value, isLast = false }) {
  return (
    <>
      <td className="px-3 py-3 text-slate-500 font-medium bg-slate-50/60 border-r align-top">
        {label}
      </td>
      <td
        className={`px-3 py-3 text-black font-semibold align-top ${isLast ? "" : "border-r"
          }`}
      >
        {value}
      </td>
    </>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-black outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition";

function money(value, currency) {
  if (value === null || value === undefined || value === "") return "-";
  const formatted = Number(value).toFixed(2);
  return currency ? `${currency} ${formatted}` : formatted;
}

function toDateInput(date) {
  if (!date) return "";

  // Take the calendar date directly when it's already "YYYY-MM-DD" (or
  // starts with it) — constructing a Date object and calling
  // toISOString() reinterprets it through a timezone and can shift the
  // day by one whenever the server's UTC offset is positive.
  const match = String(date).match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];

  const d = new Date(date);
  if (isNaN(d)) return "";

  return d.toISOString().split("T")[0];
}
