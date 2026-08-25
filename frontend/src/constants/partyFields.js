// Canonical dropdown option sets and the shared field configuration that
// drives <PartyForm /> for both Customer and Supplier. Column names below
// map 1:1 to the `customers` / `suppliers` tables (see migrations 0012 and
// 0014) so the payload built from this form can be sent straight to
// customerApi/supplierApi without renaming keys.

export const SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "Miss.", "Dr."];

export const CUSTOMER_TYPES = ["Business", "Individual"];

export const VENDOR_TYPES = ["Goods", "Services", "Both"];

export const TAX_TREATMENTS = [
  "VAT Registered",
  "Non VAT Registered",
  "GCC VAT Registered",
  "GCC Non VAT Registered",
  "VAT Registered - Designated Zones",
  "Non VAT Registered - Designated Zones",
  "Non GCC",
];

export const CURRENCIES = [
  "AED",
  "USD",
  "EUR",
  "GBP",
  "SAR",
  "OMR",
  "QAR",
  "KWD",
  "BHD",
  "INR",
  "PKR",
];

export const PAYMENT_TERMS = [
  "Due on Receipt",
  "7 Days",
  "15 Days",
  "30 Days",
  "45 Days",
  "60 Days",
  "90 Days",
  "120 Days",
];

export const RISK_LEVELS = ["Low", "Medium", "High"];

export const APPROVAL_STATUSES = ["Pending", "Approved", "Rejected"];

export const CUSTOMER_CATEGORIES = ["Retail", "Wholesale", "Corporate", "Government", "Other"];

export const CUSTOMER_SEGMENTS = ["Enterprise", "SMB", "Individual", "Other"];

export const VENDOR_CATEGORIES = ["Raw Materials", "Office Supplies", "Professional Services", "Logistics", "Other"];

export const VENDOR_CLASSIFICATIONS = ["Preferred", "Approved", "Under Review", "Blacklisted"];

export const PROCUREMENT_CATEGORIES = ["Direct", "Indirect", "Capital Expenditure", "Services"];

const CONTACT_FIELDS = [
  { name: "email", label: "Email", type: "email", required: true },
  { name: "phone", label: "Phone", type: "tel", required: true },
  { name: "mobile", label: "Mobile", type: "tel" },
  { name: "website", label: "Website", type: "text" },
  { name: "department", label: "Department", type: "text" },
  { name: "designation", label: "Designation", type: "text" },
];

const TAX_FINANCIAL_FIELDS = [
  { name: "trn", label: "TRN", type: "text", required: true },
  { name: "tax_treatment", label: "Tax Treatment", type: "select", options: TAX_TREATMENTS },
  { name: "place_of_supply", label: "Place of Supply", type: "text" },
  { name: "currency", label: "Currency", type: "select", options: CURRENCIES },
  { name: "payment_terms", label: "Payment Terms", type: "select", options: PAYMENT_TERMS },
  { name: "opening_balance", label: "Opening Balance", type: "number" },
  { name: "opening_balance_date", label: "Opening Balance Date", type: "date" },
];

const BILLING_ADDRESS_FIELDS = [
  { name: "billing_attention", label: "Attention", type: "text" },
  { name: "billing_country", label: "Country", type: "text", required: true },
  { name: "billing_address_line1", label: "Address Line 1", type: "text" },
  { name: "billing_address_line2", label: "Address Line 2", type: "text" },
  { name: "billing_city", label: "City", type: "text", required: true },
  { name: "billing_state", label: "State", type: "text" },
  { name: "billing_postal_code", label: "Postal Code", type: "text" },
  { name: "billing_phone", label: "Phone", type: "tel" },
];

const SHIPPING_ADDRESS_FIELDS = [
  { name: "shipping_attention", label: "Attention", type: "text" },
  { name: "shipping_country", label: "Country", type: "text" },
  { name: "shipping_address_line1", label: "Address Line 1", type: "text" },
  { name: "shipping_address_line2", label: "Address Line 2", type: "text" },
  { name: "shipping_city", label: "City", type: "text" },
  { name: "shipping_state", label: "State", type: "text" },
  { name: "shipping_postal_code", label: "Postal Code", type: "text" },
  { name: "shipping_phone", label: "Phone", type: "tel" },
];

export const PARTY_FIELD_CONFIG = {
  customer: [
    {
      title: "Basic Info",
      fields: [
        { name: "salutation", label: "Salutation", type: "select", options: SALUTATIONS },
        { name: "primary_contact_first_name", label: "First Name", type: "text" },
        { name: "primary_contact_last_name", label: "Last Name", type: "text" },
        { name: "company_name", label: "Company Name", type: "text", required: true },
        { name: "display_name", label: "Display Name", type: "text" },
        { name: "customer_type", label: "Customer Type", type: "select", options: CUSTOMER_TYPES },
      ],
    },
    {
      title: "Contact",
      fields: CONTACT_FIELDS,
    },
    {
      title: "Tax & Financial",
      fields: TAX_FINANCIAL_FIELDS,
    },
    {
      title: "Billing Address",
      fields: BILLING_ADDRESS_FIELDS,
    },
    {
      title: "Shipping Address",
      fields: SHIPPING_ADDRESS_FIELDS,
    },
    {
      title: "Category & Management",
      fields: [
        { name: "customer_category", label: "Customer Category", type: "select", options: CUSTOMER_CATEGORIES },
        { name: "customer_segment", label: "Customer Segment", type: "select", options: CUSTOMER_SEGMENTS },
        { name: "risk", label: "Risk", type: "select", options: RISK_LEVELS },
        { name: "approval_status", label: "Approval Status", type: "select", options: APPROVAL_STATUSES },
        { name: "portal_access", label: "Portal Access", type: "checkbox" },
        { name: "portal_language", label: "Portal Language", type: "text" },
        { name: "salesperson", label: "Salesperson", type: "text" },
        { name: "account_manager", label: "Account Manager", type: "text" },
        { name: "cost_centre", label: "Cost Centre", type: "text" },
        { name: "notes", label: "Notes", type: "textarea", fullWidth: true },
      ],
    },
  ],

  supplier: [
    {
      title: "Basic Info",
      fields: [
        { name: "vendor_type", label: "Vendor Type", type: "select", options: VENDOR_TYPES },
        { name: "salutation", label: "Salutation", type: "select", options: SALUTATIONS },
        { name: "primary_contact_first_name", label: "First Name", type: "text" },
        { name: "primary_contact_last_name", label: "Last Name", type: "text" },
        { name: "company_name", label: "Company Name", type: "text", required: true },
        { name: "display_name", label: "Display Name", type: "text" },
      ],
    },
    {
      title: "Contact",
      fields: CONTACT_FIELDS,
    },
    {
      title: "Tax & Financial",
      fields: TAX_FINANCIAL_FIELDS,
    },
    {
      title: "Billing Address",
      fields: BILLING_ADDRESS_FIELDS,
    },
    {
      title: "Shipping Address",
      fields: SHIPPING_ADDRESS_FIELDS,
    },
    {
      title: "Category & Procurement",
      fields: [
        { name: "vendor_category", label: "Vendor Category", type: "select", options: VENDOR_CATEGORIES },
        { name: "vendor_classification", label: "Vendor Classification", type: "select", options: VENDOR_CLASSIFICATIONS },
        { name: "procurement_category", label: "Procurement Category", type: "select", options: PROCUREMENT_CATEGORIES },
        { name: "default_expense_account", label: "Default Expense Account", type: "text" },
        { name: "notes", label: "Notes", type: "textarea", fullWidth: true },
      ],
    },
  ],
};

// Required-field set per entity type, kept in sync with the config above
// (also enforced server-side in customerService.js / supplierService.js).
export const REQUIRED_FIELDS = {
  customer: ["company_name", "email", "phone", "trn", "billing_country", "billing_city"],
  supplier: ["company_name", "email", "phone", "billing_country", "billing_city", "trn"],
};

export function buildInitialValues(entityType) {
  const initial = {};
  for (const section of PARTY_FIELD_CONFIG[entityType]) {
    for (const field of section.fields) {
      initial[field.name] = field.type === "checkbox" ? false : "";
    }
  }
  return initial;
}
