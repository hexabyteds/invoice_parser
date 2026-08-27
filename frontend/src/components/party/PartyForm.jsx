import { useEffect, useState } from "react";
import { PARTY_FIELD_CONFIG, buildInitialValues } from "../../constants/partyFields";
import { COUNTRIES } from "../../constants/countries";
import { getCitiesForCountry } from "../../constants/citiesByCountry";

// Fields whose city field is paired to it, e.g. billing_country ->
// billing_city — looked up so changing a country can drop a now-invalid
// city selection rather than silently keeping a mismatched one.
function citiesFieldsFor(sections) {
  return sections
    .flatMap((s) => s.fields)
    .filter((f) => f.type === "city");
}

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
    setForm((prev) => {
      const next = { ...prev, [name]: value };

      // Changing a country invalidates whichever city was picked for the
      // old one — always clear it rather than leaving a stale value
      // sitting in a field the new city list may not even contain.
      const pairedCityField = citiesFieldsFor(sections).find(
        (f) => f.countryField === name
      );

      if (pairedCityField) {
        next[pairedCityField.name] = "";
      }

      return next;
    });

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
                countryValue={field.countryField ? form[field.countryField] : undefined}
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

function Field({ field, value, countryValue, error, onChange }) {
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
    // A previously-saved free-text value (from before this field was a
    // dropdown, or one just outside the option list) must still show up
    // selected rather than silently appearing blank — same safety net as
    // the country/city dropdowns below.
    const baseOptions = field.options || [];
    const options = value && !baseOptions.includes(value) ? [value, ...baseOptions] : baseOptions;

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
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  if (field.type === "country") {
    // Same legacy-value safety net as the city dropdown below — a
    // previously-saved free-text country still shows up selected.
    const countryNames = COUNTRIES.map((c) => c.name);
    const options = value && !countryNames.includes(value) ? [value, ...countryNames] : countryNames;

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
          <option value="">Select Country</option>
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  if (field.type === "city") {
    return (
      <CityField field={field} value={value} countryValue={countryValue} error={error} onChange={onChange} wrapperClass={wrapperClass} />
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

// Cities load asynchronously (see citiesByCountry.js — the underlying
// dataset is dynamically imported, not bundled eagerly) so this needs its
// own loading state rather than being a pure render like the other Field
// branches.
function CityField({ field, value, countryValue, error, onChange, wrapperClass }) {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!countryValue) {
      setCities([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getCitiesForCountry(countryValue).then((names) => {
      if (!cancelled) {
        setCities(names);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [countryValue]);

  // A previously-saved free-text city (before this dropdown existed, or
  // one just outside our data source's coverage) must still show up
  // selected rather than silently appearing blank.
  const options = value && !cities.includes(value) ? [value, ...cities] : cities;
  const disabled = !countryValue;

  return (
    <div className={wrapperClass}>
      <label className="text-sm font-semibold text-slate-900">
        {field.label}
        {field.required && " *"}
      </label>
      <select
        value={value ?? ""}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-2 w-full rounded-xl bg-white border px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 ${
          error ? "border-red-500" : "border-slate-200"
        }`}
      >
        <option value="">
          {disabled
            ? "Select a country first"
            : loading
              ? "Loading cities..."
              : options.length
                ? "Select City"
                : "No cities available"}
        </option>
        {options.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>
      {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
    </div>
  );
}
