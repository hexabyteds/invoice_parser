import { useEffect, useState } from "react";
import { PARTY_FIELD_CONFIG, buildInitialValues } from "../../constants/partyFields";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\-\s()]{7,20}$/;
const TRN_PATTERN = /^[0-9]+$/;

function mergeValues(entityType, values) {
  return { ...buildInitialValues(entityType), ...(values || {}) };
}

export default function PartyForm({
  entityType,
  initialValues,
  onSubmit,
  submitting = false,
  submitLabel = "Save",
}) {
  const sections = PARTY_FIELD_CONFIG[entityType] || [];

  const [form, setForm] = useState(() => mergeValues(entityType, initialValues));
  const [errors, setErrors] = useState({});

  // Re-sync when the parent hands us freshly-loaded initial values (edit
  // mode: the record loads asynchronously after first render).
  useEffect(() => {
    setForm(mergeValues(entityType, initialValues));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues, entityType]);

  function handleChange(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function validate() {
    const nextErrors = {};

    for (const section of sections) {
      for (const field of section.fields) {
        const value = form[field.name];
        const stringValue = typeof value === "string" ? value.trim() : value;

        if (field.required && !stringValue) {
          nextErrors[field.name] = `${field.label} is required.`;
          continue;
        }

        if (!stringValue) continue;

        if (field.name === "email" && !EMAIL_PATTERN.test(stringValue)) {
          nextErrors[field.name] = "Enter a valid email address.";
        } else if (field.type === "tel" && !PHONE_PATTERN.test(stringValue)) {
          nextErrors[field.name] = "Enter a valid phone number.";
        } else if (field.name === "trn" && !TRN_PATTERN.test(stringValue)) {
          nextErrors[field.name] = "TRN must contain digits only.";
        }
      }
    }

    return nextErrors;
  }

  function handleSubmit(e) {
    e.preventDefault();

    const nextErrors = validate();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      {sections.map((section) => (
        <div key={section.title} className="bg-white rounded-3xl shadow border p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">{section.title}</h2>

          <div className="grid md:grid-cols-2 gap-5">
            {section.fields.map((field) => (
              <Field
                key={field.name}
                field={field}
                value={form[field.name]}
                error={errors[field.name]}
                onChange={(value) => handleChange(field.name, value)}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold disabled:opacity-60 transition"
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({ field, value, error, onChange }) {
  const wrapperClass = field.fullWidth ? "md:col-span-2" : "";

  if (field.type === "checkbox") {
    return (
      <div className={`flex items-center gap-3 ${wrapperClass}`}>
        <input
          id={field.name}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
        />
        <label htmlFor={field.name} className="text-sm font-semibold text-slate-900">
          {field.label}
        </label>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className={wrapperClass}>
        <label className="text-sm font-semibold text-slate-900">
          {field.label}
          {field.required && " *"}
        </label>
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`mt-2 w-full rounded-xl bg-white border px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
            error ? "border-red-500" : "border-slate-200"
          }`}
        >
          <option value="">Select {field.label}</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className={wrapperClass}>
        <label className="text-sm font-semibold text-slate-900">{field.label}</label>
        <textarea
          rows={4}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`mt-2 w-full rounded-xl bg-white border px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
            error ? "border-red-500" : "border-slate-200"
          }`}
        />
        {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <label className="text-sm font-semibold text-slate-900">
        {field.label}
        {field.required && " *"}
      </label>
      <input
        type={field.type === "tel" ? "text" : field.type}
        value={value ?? ""}
        step={field.type === "number" ? "0.01" : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-2 w-full rounded-xl bg-white border px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
          error ? "border-red-500" : "border-slate-200"
        }`}
      />
      {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
    </div>
  );
}
