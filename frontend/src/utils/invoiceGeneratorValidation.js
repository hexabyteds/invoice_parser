// Pure validation functions for the public Invoice Generator form.
// Kept dependency-free and separate from InvoiceGeneratorTool.jsx's plain
// useState state so the rules are easy to unit test and reuse — this repo
// doesn't use react-hook-form/Formik/Zod anywhere in its form UI (only in
// a couple of auth pages), so a form library isn't introduced here either.
//
// Length limits mirror services/invoiceGeneratorService.js on the backend
// (the actual source of truth, since the backend never trusts the
// frontend) so a user sees a validation error here instead of only
// discovering the same limit after a failed API call.

export const BUSINESS_NAME_MIN = 2;
export const BUSINESS_NAME_MAX = 30;

const LIMITS = {
  personName: 100,
  invoiceNumber: 50,
  shortText: 30, // TRN, phone
  address: 200,
  notes: 500,
};

function isBlank(value) {
  return !value || !String(value).trim();
}

export function validateBusinessName(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "Business name is required.";
  if (trimmed.length < BUSINESS_NAME_MIN) {
    return `Business name must be at least ${BUSINESS_NAME_MIN} characters.`;
  }
  if (trimmed.length > BUSINESS_NAME_MAX) {
    return `Business name must be ${BUSINESS_NAME_MAX} characters or less.`;
  }
  return null;
}

export function validateRequiredText(value, label, max = LIMITS.personName) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return `${label} is required.`;
  if (trimmed.length > max) return `${label} must be ${max} characters or less.`;
  return null;
}

export function validateOptionalText(value, label, max) {
  if (isBlank(value)) return null;
  if (String(value).trim().length > max) return `${label} must be ${max} characters or less.`;
  return null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value, label) {
  if (isBlank(value)) return null; // optional everywhere it's used
  if (!EMAIL_PATTERN.test(String(value).trim())) {
    return `${label} must be a valid email address.`;
  }
  return null;
}

export function validateInvoiceDate(value) {
  if (!value) return "Invoice date is required.";
  if (Number.isNaN(new Date(value).getTime())) return "Invoice date is not valid.";
  return null;
}

export function validateDueDate(value, invoiceDate) {
  if (isBlank(value)) return null; // optional
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "Due date is not valid.";
  if (invoiceDate && !Number.isNaN(new Date(invoiceDate).getTime()) && due < new Date(invoiceDate)) {
    return "Due date cannot be before the invoice date.";
  }
  return null;
}

// Empty-string/NaN/Infinity are all treated as "not a valid number" —
// Number("") is 0 in JS, which would silently accept an empty field, so
// this checks the raw value first rather than trusting Number(value) alone.
function toFiniteNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function validateQuantity(value) {
  const num = toFiniteNumber(value);
  if (num === null) return "Quantity must be a valid number.";
  if (num <= 0) return "Quantity must be greater than 0.";
  return null;
}

export function validateUnitPrice(value) {
  const num = toFiniteNumber(value);
  if (num === null) return "Price must be a valid number.";
  if (num < 0) return "Price cannot be negative.";
  return null;
}

export function validateDiscount(value, quantity, unitPrice) {
  if (isBlank(value) && value !== 0) return null; // optional, defaults to 0
  const num = toFiniteNumber(value);
  if (num === null) return "Discount must be a valid number.";
  if (num < 0) return "Discount cannot be negative.";
  const gross = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  if (num > gross) return "Discount cannot exceed the item's total.";
  return null;
}

// A line item only "counts" once the user has entered a description; an
// untouched default row (empty description, quantity 1, price 0) must not
// show errors. Quantity/price/discount are only validated once a
// description exists — matches the backend, which silently drops any row
// with no description rather than erroring on it.
function validateLineItem(item) {
  const errors = {};
  const hasDescription = !isBlank(item.description);
  const hasPricingData = Number(item.unitPrice) > 0 || Number(item.discount) > 0;

  if (hasPricingData && !hasDescription) {
    errors.description = "Description is required for this item.";
  } else if (hasDescription) {
    const maxLenErr = validateRequiredText(item.description, "Description", 200);
    if (maxLenErr) errors.description = maxLenErr;
  }

  if (hasDescription) {
    const qtyErr = validateQuantity(item.quantity);
    if (qtyErr) errors.quantity = qtyErr;

    const priceErr = validateUnitPrice(item.unitPrice);
    if (priceErr) errors.unitPrice = priceErr;

    const discountErr = validateDiscount(item.discount, item.quantity, item.unitPrice);
    if (discountErr) errors.discount = discountErr;
  }

  return errors;
}

// Returns a flat { "business.name": "message", "lineItems.0.quantity": "message", ... }
// map — empty object means the form is valid. Flat keys keep touched-state
// tracking and ref-based focus-on-submit-fail simple without deep merges.
export function validateInvoiceForm(state) {
  const errors = {};

  const nameErr = validateBusinessName(state.business.name);
  if (nameErr) errors["business.name"] = nameErr;

  const businessEmailErr = validateEmail(state.business.email, "Business email");
  if (businessEmailErr) errors["business.email"] = businessEmailErr;

  const hasCustomerName = !isBlank(state.customer.name) || !isBlank(state.customer.companyName);
  if (!hasCustomerName) {
    errors["customer.name"] = "Customer name or company name is required.";
  }
  const customerEmailErr = validateEmail(state.customer.email, "Customer email");
  if (customerEmailErr) errors["customer.email"] = customerEmailErr;

  const invoiceNumberErr = validateRequiredText(state.invoice.invoiceNumber, "Invoice number", LIMITS.invoiceNumber);
  if (invoiceNumberErr) errors["invoice.invoiceNumber"] = invoiceNumberErr;

  const invoiceDateErr = validateInvoiceDate(state.invoice.invoiceDate);
  if (invoiceDateErr) errors["invoice.invoiceDate"] = invoiceDateErr;

  const dueDateErr = validateDueDate(state.invoice.dueDate, state.invoice.invoiceDate);
  if (dueDateErr) errors["invoice.dueDate"] = dueDateErr;

  let anyLineItemHasDescription = false;
  state.lineItems.forEach((item, index) => {
    if (!isBlank(item.description)) anyLineItemHasDescription = true;
    const itemErrors = validateLineItem(item);
    Object.entries(itemErrors).forEach(([field, message]) => {
      errors[`lineItems.${index}.${field}`] = message;
    });
  });
  if (!anyLineItemHasDescription) {
    errors["lineItems.form"] = "Add at least one item with a description.";
  }

  return errors;
}
