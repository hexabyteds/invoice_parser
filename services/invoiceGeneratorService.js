const { calcLineTotal, calcInvoiceTotals } = require("../utils/invoiceCalc");
const { generateInvoicePdf } = require("./invoiceGeneratorPdfService");

// Public, unauthenticated endpoint — nothing here is persisted, so these
// limits exist purely to keep PDF generation (real CPU work) from being
// abused, and to keep the rendered layout from breaking on absurd input.
const MAX_LINE_ITEMS = 100;
const MAX_TEXT_LENGTH = 200;
const MAX_NOTES_LENGTH = 500;
const MAX_MONEY = 10_000_000;
const ALLOWED_CURRENCIES = new Set(["AED", "USD", "EUR", "GBP", "SAR"]);
const ALLOWED_VAT_MODES = new Set(["exclusive", "inclusive"]);

function requireString(value, field, { maxLength = MAX_TEXT_LENGTH, required = true } = {}) {
  const str = typeof value === "string" ? value.trim() : "";
  if (required && !str) {
    throw new Error(`${field} is required.`);
  }
  if (str.length > maxLength) {
    throw new Error(`${field} must be ${maxLength} characters or fewer.`);
  }
  return str;
}

function requireMoney(value, field, { min = 0 } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > MAX_MONEY) {
    throw new Error(`${field} must be a number between ${min} and ${MAX_MONEY}.`);
  }
  return num;
}

function requireDate(value, field) {
  const str = requireString(value, field, { maxLength: 20 });
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} is not a valid date.`);
  }
  return { str, date };
}

function validateAndBuildInvoiceData(input) {
  const body = input && typeof input === "object" ? input : {};
  const business = body.business || {};
  const customer = body.customer || {};
  const invoiceInput = body.invoice || {};
  const rawLineItems = Array.isArray(body.lineItems) ? body.lineItems : [];

  if (rawLineItems.length === 0) {
    throw new Error("At least one line item is required.");
  }
  if (rawLineItems.length > MAX_LINE_ITEMS) {
    throw new Error(`No more than ${MAX_LINE_ITEMS} line items are allowed.`);
  }

  const businessName = requireString(business.name, "Business name");
  const customerName = requireString(customer.companyName, "Customer company name", { required: false })
    || requireString(customer.name, "Customer name", { required: false });
  if (!customerName) {
    throw new Error("Customer name or company name is required.");
  }

  const invoiceNumber = requireString(invoiceInput.invoiceNumber, "Invoice number", { maxLength: 50 });
  const { str: invoiceDateStr, date: invoiceDate } = requireDate(invoiceInput.invoiceDate, "Invoice date");

  let dueDateStr = "";
  if (invoiceInput.dueDate) {
    const { str, date: dueDate } = requireDate(invoiceInput.dueDate, "Due date");
    if (dueDate < invoiceDate) {
      throw new Error("Due date cannot be before the invoice date.");
    }
    dueDateStr = str;
  }

  const currency = requireString(invoiceInput.currency, "Currency", { maxLength: 10, required: false }) || "AED";
  if (!ALLOWED_CURRENCIES.has(currency)) {
    throw new Error(`Currency must be one of: ${[...ALLOWED_CURRENCIES].join(", ")}.`);
  }

  const vatMode = invoiceInput.vatMode && ALLOWED_VAT_MODES.has(invoiceInput.vatMode)
    ? invoiceInput.vatMode
    : "exclusive";
  const vatRate = requireMoney(body.vatRate ?? 5, "VAT rate", { min: 0 });
  if (vatRate > 100) {
    throw new Error("VAT rate cannot exceed 100.");
  }

  const lineItems = rawLineItems.map((item, index) => {
    const label = `Line item ${index + 1}`;
    const description = requireString(item.description, `${label} description`);
    const quantity = requireMoney(item.quantity, `${label} quantity`, { min: 0.01 });
    const unitPrice = requireMoney(item.unitPrice, `${label} unit price`, { min: 0 });
    const discount = requireMoney(item.discount ?? 0, `${label} discount`, { min: 0 });
    return {
      description,
      quantity,
      unit: requireString(item.unit, `${label} unit`, { maxLength: 30, required: false }),
      unitPrice,
      discount,
      lineTotal: calcLineTotal(quantity, unitPrice, discount),
    };
  });

  const totals = calcInvoiceTotals(lineItems, vatRate, vatMode);

  return {
    business: {
      name: businessName,
      trn: requireString(business.trn, "Business TRN", { maxLength: 30, required: false }),
      email: requireString(business.email, "Business email", { maxLength: 100, required: false }),
      phone: requireString(business.phone, "Business phone", { maxLength: 30, required: false }),
      address: requireString(business.address, "Business address", { maxLength: 200, required: false }),
      city: requireString(business.city, "Business city", { maxLength: 100, required: false }),
      country: requireString(business.country, "Business country", { maxLength: 100, required: false }),
    },
    customer: {
      name: requireString(customer.name, "Customer name", { required: false }),
      companyName: requireString(customer.companyName, "Customer company name", { required: false }),
      email: requireString(customer.email, "Customer email", { maxLength: 100, required: false }),
      trn: requireString(customer.trn, "Customer TRN", { maxLength: 30, required: false }),
      billingAddress: requireString(customer.billingAddress, "Customer billing address", { maxLength: 200, required: false }),
    },
    invoice: {
      invoiceNumber,
      invoiceDate: invoiceDateStr,
      dueDate: dueDateStr,
      poNumber: requireString(invoiceInput.poNumber, "PO/reference number", { maxLength: 50, required: false }),
      currency,
      notes: requireString(invoiceInput.notes, "Notes", { maxLength: MAX_NOTES_LENGTH, required: false }),
    },
    lineItems,
    totals,
  };
}

async function buildInvoicePdf(rawInput) {
  const invoiceData = validateAndBuildInvoiceData(rawInput);
  const pdfBytes = await generateInvoicePdf(invoiceData);
  return { pdfBytes, invoiceData };
}

module.exports = { buildInvoicePdf, validateAndBuildInvoiceData };
