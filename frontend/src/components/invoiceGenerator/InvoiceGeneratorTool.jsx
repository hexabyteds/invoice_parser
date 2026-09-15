import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Download, Loader2 } from "lucide-react";

import { calcInvoiceTotals } from "../../utils/invoiceCalc";
import { generateInvoicePdf } from "../../services/invoiceGeneratorApi";
import InvoiceLivePreview from "./InvoiceLivePreview";

const CURRENCIES = ["AED", "USD", "EUR", "GBP", "SAR"];

function emptyLineItem() {
  return { description: "", quantity: 1, unit: "", unitPrice: 0, discount: 0 };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function defaultState() {
  return {
    business: { name: "", trn: "", email: "", phone: "", address: "", city: "", country: "United Arab Emirates" },
    customer: { name: "", companyName: "", email: "", trn: "", billingAddress: "" },
    invoice: {
      invoiceNumber: "INV-0001",
      invoiceDate: todayIso(),
      dueDate: "",
      poNumber: "",
      currency: "AED",
      notes: "",
    },
    vatRate: 5,
    vatMode: "exclusive",
    lineItems: [emptyLineItem()],
  };
}

// GTM's own History Change auto-tracking is off (see useAnalytics.js);
// this follows the same explicit dataLayer.push pattern for a genuinely
// new custom event. Deliberately no invoice content in the payload —
// event name only, per the no-PII-in-analytics rule this app follows
// throughout (see the token-redaction work in useAnalytics.js).
function trackEvent(event) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event });
}

function Field({ label, ...props }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-300">{label}</span>
      <input
        {...props}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
      />
    </label>
  );
}

export default function InvoiceGeneratorTool() {
  const [state, setState] = useState(defaultState);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [downloaded, setDownloaded] = useState(false);

  const totals = useMemo(
    () => calcInvoiceTotals(state.lineItems, state.vatRate, state.vatMode),
    [state.lineItems, state.vatRate, state.vatMode]
  );

  function updateField(section, field, value) {
    setState((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  }

  function updateLineItem(index, field, value) {
    setState((prev) => {
      const lineItems = [...prev.lineItems];
      lineItems[index] = { ...lineItems[index], [field]: value };
      return { ...prev, lineItems };
    });
  }

  function addLineItem() {
    setState((prev) => ({ ...prev, lineItems: [...prev.lineItems, emptyLineItem()] }));
    trackEvent("invoice_line_item_added");
  }

  function removeLineItem(index) {
    setState((prev) => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== index) }));
  }

  function resetInvoice() {
    const hasContent =
      state.business.name || state.customer.name || state.customer.companyName ||
      state.lineItems.some((item) => item.description);
    if (hasContent && !window.confirm("Start a new invoice? Your current invoice will be cleared.")) {
      return;
    }
    setState(defaultState());
    setDownloaded(false);
    setError("");
  }

  const canDownload =
    state.business.name.trim() &&
    (state.customer.name.trim() || state.customer.companyName.trim()) &&
    state.invoice.invoiceNumber.trim() &&
    state.lineItems.some((item) => item.description.trim() && Number(item.unitPrice) >= 0 && Number(item.quantity) > 0);

  async function handleDownload() {
    setError("");
    setDownloading(true);
    try {
      const blob = await generateInvoicePdf({
        business: state.business,
        customer: state.customer,
        invoice: state.invoice,
        lineItems: state.lineItems.filter((item) => item.description.trim()),
        vatRate: state.vatRate,
        vatMode: state.vatMode,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${state.invoice.invoiceNumber || "invoice"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setDownloaded(true);
      trackEvent("invoice_downloaded");
    } catch (err) {
      setError(err.message || "Couldn't generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-400">Your Business</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              label="Business name"
              value={state.business.name}
              onChange={(e) => updateField("business", "name", e.target.value)}
              placeholder="Acme Consulting FZE"
            />
            <Field
              label="TRN (optional)"
              value={state.business.trn}
              onChange={(e) => updateField("business", "trn", e.target.value)}
            />
            <Field
              label="Email (optional)"
              type="email"
              value={state.business.email}
              onChange={(e) => updateField("business", "email", e.target.value)}
            />
            <Field
              label="Phone (optional)"
              value={state.business.phone}
              onChange={(e) => updateField("business", "phone", e.target.value)}
            />
            <Field
              label="Address (optional)"
              value={state.business.address}
              onChange={(e) => updateField("business", "address", e.target.value)}
            />
            <Field
              label="City (optional)"
              value={state.business.city}
              onChange={(e) => updateField("business", "city", e.target.value)}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-400">Customer</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              label="Customer name"
              value={state.customer.name}
              onChange={(e) => updateField("customer", "name", e.target.value)}
            />
            <Field
              label="Company name (optional)"
              value={state.customer.companyName}
              onChange={(e) => updateField("customer", "companyName", e.target.value)}
            />
            <Field
              label="Email (optional)"
              type="email"
              value={state.customer.email}
              onChange={(e) => updateField("customer", "email", e.target.value)}
            />
            <Field
              label="TRN (optional)"
              value={state.customer.trn}
              onChange={(e) => updateField("customer", "trn", e.target.value)}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-400">Invoice Details</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              label="Invoice number"
              value={state.invoice.invoiceNumber}
              onChange={(e) => updateField("invoice", "invoiceNumber", e.target.value)}
            />
            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">Currency</span>
              <select
                value={state.invoice.currency}
                onChange={(e) => updateField("invoice", "currency", e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <Field
              label="Invoice date"
              type="date"
              value={state.invoice.invoiceDate}
              onChange={(e) => updateField("invoice", "invoiceDate", e.target.value)}
            />
            <Field
              label="Due date (optional)"
              type="date"
              value={state.invoice.dueDate}
              onChange={(e) => updateField("invoice", "dueDate", e.target.value)}
            />
            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">VAT rate</span>
              <select
                value={state.vatRate}
                onChange={(e) => setState((prev) => ({ ...prev, vatRate: Number(e.target.value) }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value={0}>0% (No VAT)</option>
                <option value={5}>5% (UAE standard)</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-300">VAT is</span>
              <select
                value={state.vatMode}
                onChange={(e) => setState((prev) => ({ ...prev, vatMode: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="exclusive">Exclusive (added on top)</option>
                <option value="inclusive">Inclusive (already in prices)</option>
              </select>
            </label>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-400">Line Items</h2>
            <button
              type="button"
              onClick={addLineItem}
              className="flex items-center gap-1 text-sm font-medium text-indigo-400 hover:text-indigo-300"
            >
              <Plus size={16} /> Add Item
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {state.lineItems.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 rounded-lg border border-slate-800 p-3">
                <input
                  className="col-span-12 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none sm:col-span-5"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateLineItem(index, "description", e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="col-span-4 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none sm:col-span-2"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="col-span-4 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none sm:col-span-2"
                  placeholder="Unit price"
                  value={item.unitPrice}
                  onChange={(e) => updateLineItem(index, "unitPrice", e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="col-span-3 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none sm:col-span-2"
                  placeholder="Discount"
                  value={item.discount}
                  onChange={(e) => updateLineItem(index, "discount", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeLineItem(index)}
                  disabled={state.lineItems.length === 1}
                  className="col-span-1 flex items-center justify-center rounded-md text-slate-500 hover:text-red-400 disabled:opacity-30"
                  aria-label="Remove line item"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {error && (
          <p role="alert" className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!canDownload || downloading}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {downloading ? "Generating…" : "Download PDF"}
          </button>
          <button
            type="button"
            onClick={resetInvoice}
            className="rounded-xl border border-slate-700 px-6 py-3 font-semibold text-slate-300 transition hover:border-slate-500"
          >
            New Invoice
          </button>
        </div>

        {downloaded && (
          <div className="rounded-xl border border-indigo-800 bg-indigo-950/40 p-5">
            <p className="font-semibold text-white">Save &amp; Manage Your Invoice</p>
            <p className="mt-1 text-sm text-slate-400">
              Want to edit, duplicate, track, and manage your invoices later? Create a free EazeeBooks account.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                to="/register"
                onClick={() => trackEvent("invoice_signup_cta_clicked")}
                className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold transition hover:opacity-90"
              >
                Create Free Account
              </Link>
              <Link
                to="/login"
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-500"
              >
                Login
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-8 lg:self-start">
        <InvoiceLivePreview
          business={state.business}
          customer={state.customer}
          invoice={state.invoice}
          lineItems={state.lineItems}
          totals={totals}
        />
      </div>
    </div>
  );
}
