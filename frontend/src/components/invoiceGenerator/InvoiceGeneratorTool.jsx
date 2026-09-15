import { forwardRef, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Download, Loader2 } from "lucide-react";

import { calcInvoiceTotals } from "../../utils/invoiceCalc";
import { validateInvoiceForm, BUSINESS_NAME_MAX } from "../../utils/invoiceGeneratorValidation";
import { generateInvoicePdf } from "../../services/invoiceGeneratorApi";
import InvoiceLivePreview from "./InvoiceLivePreview";

const CURRENCIES = ["AED", "USD", "EUR", "GBP", "SAR"];

// Priority order for focusing the first invalid field when a submission
// is blocked. Line item fields are appended dynamically (see
// focusFirstError) since there can be any number of rows.
const FIELD_FOCUS_ORDER = [
  "business.name",
  "business.email",
  "customer.name",
  "customer.email",
  "invoice.invoiceNumber",
  "invoice.invoiceDate",
  "invoice.dueDate",
];

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

const Field = forwardRef(function Field({ label, error, hint, className = "", ...props }, ref) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex items-baseline justify-between text-slate-300">
        <span>{label}</span>
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </span>
      <input
        ref={ref}
        aria-invalid={error ? "true" : undefined}
        {...props}
        className={`w-full rounded-lg border bg-slate-900 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none ${
          error ? "border-red-600 focus:border-red-500" : "border-slate-700 focus:border-indigo-500"
        } ${className}`}
      />
      {error && (
        <span role="alert" className="mt-1 block text-xs text-red-400">
          {error}
        </span>
      )}
    </label>
  );
});

export default function InvoiceGeneratorTool() {
  const [state, setState] = useState(defaultState);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const fieldRefs = useRef({});

  const totals = useMemo(
    () => calcInvoiceTotals(state.lineItems, state.vatRate, state.vatMode),
    [state.lineItems, state.vatRate, state.vatMode]
  );

  // Recomputed on every keystroke so an already-invalid, already-touched
  // field's error updates live as the user fixes (or breaks) it — display
  // is gated separately by `touched`/`submitAttempted` below.
  const errors = useMemo(() => validateInvoiceForm(state), [state]);
  const isValid = Object.keys(errors).length === 0;

  function registerRef(key) {
    return (el) => {
      fieldRefs.current[key] = el;
    };
  }

  function markTouched(key) {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }

  // Trims on blur (not on every keystroke, so a trailing space doesn't
  // vanish mid-typing) — the stored value itself is trimmed, not just the
  // validation check, so a value like "  Acme Co  " doesn't quietly reach
  // the PDF with padding still in it.
  function handleTrimBlur(section, field, key) {
    return () => {
      updateField(section, field, (state[section][field] || "").trim());
      markTouched(key);
    };
  }

  function fieldError(key) {
    return touched[key] || submitAttempted ? errors[key] : undefined;
  }

  function updateField(section, field, value) {
    setState((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  }

  function handleBusinessNameChange(e) {
    // Hard cap at the input level (handles typing AND pasting uniformly)
    // in addition to the maxLength attribute and the JS length check in
    // validateBusinessName — belt and suspenders, not maxlength alone.
    updateField("business", "name", e.target.value.slice(0, BUSINESS_NAME_MAX));
  }

  function updateLineItem(index, field, value) {
    setState((prev) => {
      const lineItems = [...prev.lineItems];
      lineItems[index] = { ...lineItems[index], [field]: value };
      return { ...prev, lineItems };
    });
  }

  function rowTouched(index, field) {
    return touched[`lineItems.${index}.${field}`] || submitAttempted;
  }

  function rowError(index, field) {
    return rowTouched(index, field) ? errors[`lineItems.${index}.${field}`] : undefined;
  }

  function markRowTouched(index, field) {
    markTouched(`lineItems.${index}.${field}`);
  }

  function rowErrorMessages(index) {
    return ["description", "quantity", "unitPrice", "discount"]
      .map((field) => rowError(index, field))
      .filter(Boolean);
  }

  function addLineItem() {
    setState((prev) => ({ ...prev, lineItems: [...prev.lineItems, emptyLineItem()] }));
    trackEvent("invoice_line_item_added");
  }

  function removeLineItem(index) {
    setState((prev) => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== index) }));
    setTouched((prev) => {
      const next = {};
      for (const key of Object.keys(prev)) {
        if (!key.startsWith("lineItems.")) {
          next[key] = prev[key];
        }
      }
      return next;
    });
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
    setTouched({});
    setSubmitAttempted(false);
  }

  function focusFirstError() {
    const lineItemKeys = Object.keys(errors)
      .filter((key) => key.startsWith("lineItems.") && key !== "lineItems.form")
      .sort();
    const focusKey =
      FIELD_FOCUS_ORDER.find((key) => errors[key]) ||
      lineItemKeys[0] ||
      (errors["lineItems.form"] ? "lineItems.0.description" : null);

    fieldRefs.current[focusKey]?.focus();
  }

  async function handleDownload() {
    setError("");
    setSubmitAttempted(true);

    if (!isValid) {
      focusFirstError();
      return;
    }

    setDownloading(true);
    try {
      // Validation checks trimmed values, but doesn't rewrite state as the
      // user types — trim here too so padding never reaches the PDF even
      // if a field was filled in without ever blurring it (e.g. autofill).
      const blob = await generateInvoicePdf({
        business: { ...state.business, name: state.business.name.trim() },
        customer: {
          ...state.customer,
          name: state.customer.name.trim(),
          companyName: state.customer.companyName.trim(),
        },
        invoice: { ...state.invoice, invoiceNumber: state.invoice.invoiceNumber.trim() },
        lineItems: state.lineItems
          .filter((item) => item.description.trim())
          .map((item) => ({ ...item, description: item.description.trim() })),
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
              ref={registerRef("business.name")}
              label="Business name"
              value={state.business.name}
              onChange={handleBusinessNameChange}
              onBlur={handleTrimBlur("business", "name", "business.name")}
              error={fieldError("business.name")}
              hint={`${state.business.name.length}/${BUSINESS_NAME_MAX}`}
              maxLength={BUSINESS_NAME_MAX}
              placeholder="Acme Consulting FZE"
            />
            <Field
              label="TRN (optional)"
              value={state.business.trn}
              onChange={(e) => updateField("business", "trn", e.target.value)}
              maxLength={30}
            />
            <Field
              ref={registerRef("business.email")}
              label="Email (optional)"
              type="email"
              value={state.business.email}
              onChange={(e) => updateField("business", "email", e.target.value)}
              onBlur={() => markTouched("business.email")}
              error={fieldError("business.email")}
            />
            <Field
              label="Phone (optional)"
              value={state.business.phone}
              onChange={(e) => updateField("business", "phone", e.target.value)}
              maxLength={30}
            />
            <Field
              label="Address (optional)"
              value={state.business.address}
              onChange={(e) => updateField("business", "address", e.target.value)}
              maxLength={200}
            />
            <Field
              label="City (optional)"
              value={state.business.city}
              onChange={(e) => updateField("business", "city", e.target.value)}
              maxLength={100}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-400">Customer</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              ref={registerRef("customer.name")}
              label="Customer name"
              value={state.customer.name}
              onChange={(e) => updateField("customer", "name", e.target.value)}
              onBlur={handleTrimBlur("customer", "name", "customer.name")}
              error={fieldError("customer.name")}
              maxLength={100}
            />
            <Field
              label="Company name (optional)"
              value={state.customer.companyName}
              onChange={(e) => updateField("customer", "companyName", e.target.value)}
              onBlur={handleTrimBlur("customer", "companyName", "customer.name")}
              maxLength={100}
            />
            <Field
              ref={registerRef("customer.email")}
              label="Email (optional)"
              type="email"
              value={state.customer.email}
              onChange={(e) => updateField("customer", "email", e.target.value)}
              onBlur={() => markTouched("customer.email")}
              error={fieldError("customer.email")}
            />
            <Field
              label="TRN (optional)"
              value={state.customer.trn}
              onChange={(e) => updateField("customer", "trn", e.target.value)}
              maxLength={30}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-400">Invoice Details</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              ref={registerRef("invoice.invoiceNumber")}
              label="Invoice number"
              value={state.invoice.invoiceNumber}
              onChange={(e) => updateField("invoice", "invoiceNumber", e.target.value)}
              onBlur={handleTrimBlur("invoice", "invoiceNumber", "invoice.invoiceNumber")}
              error={fieldError("invoice.invoiceNumber")}
              maxLength={50}
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
              ref={registerRef("invoice.invoiceDate")}
              label="Invoice date"
              type="date"
              value={state.invoice.invoiceDate}
              onChange={(e) => updateField("invoice", "invoiceDate", e.target.value)}
              onBlur={() => markTouched("invoice.invoiceDate")}
              error={fieldError("invoice.invoiceDate")}
            />
            <Field
              ref={registerRef("invoice.dueDate")}
              label="Due date (optional)"
              type="date"
              value={state.invoice.dueDate}
              onChange={(e) => updateField("invoice", "dueDate", e.target.value)}
              onBlur={() => markTouched("invoice.dueDate")}
              error={fieldError("invoice.dueDate")}
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
          {fieldError("lineItems.form") && (
            <p role="alert" className="mt-2 text-xs text-red-400">
              {fieldError("lineItems.form")}
            </p>
          )}
          <div className="mt-3 space-y-3">
            {state.lineItems.map((item, index) => {
              const rowMessages = rowErrorMessages(index);
              const inputClass = (hasError) =>
                `rounded-md border bg-slate-900 px-2 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none ${
                  hasError ? "border-red-600 focus:border-red-500" : "border-slate-700 focus:border-indigo-500"
                }`;

              return (
                <div key={index} className="grid grid-cols-12 gap-2 rounded-lg border border-slate-800 p-3">
                  <input
                    ref={registerRef(`lineItems.${index}.description`)}
                    className={`col-span-12 sm:col-span-5 ${inputClass(rowError(index, "description"))}`}
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateLineItem(index, "description", e.target.value)}
                    onBlur={() => markRowTouched(index, "description")}
                    aria-invalid={rowError(index, "description") ? "true" : undefined}
                    maxLength={200}
                  />
                  <input
                    ref={registerRef(`lineItems.${index}.quantity`)}
                    type="number"
                    min="0"
                    step="0.01"
                    className={`col-span-4 sm:col-span-2 ${inputClass(rowError(index, "quantity"))}`}
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                    onBlur={() => markRowTouched(index, "quantity")}
                    aria-invalid={rowError(index, "quantity") ? "true" : undefined}
                  />
                  <input
                    ref={registerRef(`lineItems.${index}.unitPrice`)}
                    type="number"
                    min="0"
                    step="0.01"
                    className={`col-span-4 sm:col-span-2 ${inputClass(rowError(index, "unitPrice"))}`}
                    placeholder="Unit price"
                    value={item.unitPrice}
                    onChange={(e) => updateLineItem(index, "unitPrice", e.target.value)}
                    onBlur={() => markRowTouched(index, "unitPrice")}
                    aria-invalid={rowError(index, "unitPrice") ? "true" : undefined}
                  />
                  <input
                    ref={registerRef(`lineItems.${index}.discount`)}
                    type="number"
                    min="0"
                    step="0.01"
                    className={`col-span-3 sm:col-span-2 ${inputClass(rowError(index, "discount"))}`}
                    placeholder="Discount"
                    value={item.discount}
                    onChange={(e) => updateLineItem(index, "discount", e.target.value)}
                    onBlur={() => markRowTouched(index, "discount")}
                    aria-invalid={rowError(index, "discount") ? "true" : undefined}
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
                  {rowMessages.length > 0 && (
                    <p role="alert" className="col-span-12 text-xs text-red-400">
                      {rowMessages.join(" ")}
                    </p>
                  )}
                </div>
              );
            })}
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
            disabled={downloading}
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
