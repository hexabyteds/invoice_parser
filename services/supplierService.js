const supplierRepository = require("../repositories/supplierRepository");
const usageService = require("./usageService");
const auditLogRepository = require("../repositories/auditLogRepository");

// Matches the actual VARCHAR(n) size of each column in the `suppliers`
// table (db/schema.sql) — exceeding it used to reach the DB and come back
// as a raw "Data too long for column '...'" MySQL error instead of a
// clean validation error. `notes` is a TEXT column (64KB+) and doesn't
// need a practical limit.
const FIELD_MAX_LENGTHS = {
    vendor_type: 50,
    salutation: 20,
    primary_contact_first_name: 150,
    primary_contact_last_name: 150,
    company_name: 255,
    display_name: 255,
    email: 255,
    phone: 30,
    mobile: 30,
    website: 255,
    department: 150,
    designation: 150,
    tax_treatment: 50,
    trn: 100,
    place_of_supply: 100,
    currency: 20,
    payment_terms: 50,
    billing_attention: 150,
    billing_country: 100,
    billing_address_line1: 255,
    billing_address_line2: 255,
    billing_city: 100,
    billing_state: 100,
    billing_postal_code: 20,
    billing_phone: 30,
    shipping_attention: 150,
    shipping_country: 100,
    shipping_address_line1: 255,
    shipping_address_line2: 255,
    shipping_city: 100,
    shipping_state: 100,
    shipping_postal_code: 20,
    shipping_phone: 30,
    vendor_category: 100,
    vendor_classification: 100,
    procurement_category: 100,
    default_expense_account: 150,
};

const REQUIRED_FIELDS = ["company_name", "email", "phone", "billing_country", "billing_city", "trn"];

// Everything else in FIELD_MAX_LENGTHS, plus a couple of non-VARCHAR
// columns, is optional.
const OPTIONAL_FIELDS = Object.keys(FIELD_MAX_LENGTHS)
    .filter((f) => !REQUIRED_FIELDS.includes(f))
    .concat(["opening_balance", "opening_balance_date"]);

function validateFieldLengths(data) {
    for (const field of Object.keys(FIELD_MAX_LENGTHS)) {
        const value = data[field];
        const max = FIELD_MAX_LENGTHS[field];

        if (typeof value === "string" && value.length > max) {
            throw new Error(
                `${field.replace(/_/g, " ")} must be ${max} characters or fewer.`
            );
        }
    }
}

function pickOptionalFields(data, existing = {}) {
    const out = {};
    for (const field of OPTIONAL_FIELDS) {
        out[field] = data[field] !== undefined ? data[field] : (existing[field] ?? null);
    }
    return out;
}

class SupplierService {

    // A supplier belongs to the company (companyId) — userId is only kept
    // for attribution (create), matching customerService's pattern.
    //
    // requireAllFields=false relaxes REQUIRED_FIELDS down to just
    // company_name — used only by partyResolutionService when
    // auto-creating a supplier from an extracted Bill, where billing
    // country/city aren't available (Gemini extracts one free-text vendor
    // address, not separately parsed fields) and email/phone/trn may be
    // blank. Every human-facing caller (supplierController) keeps the
    // strict default.
    async create(companyId, userId, data, { requireAllFields = true } = {}) {

        const fieldsToRequire = requireAllFields ? REQUIRED_FIELDS : ["company_name"];

        for (const field of fieldsToRequire) {
            const value = data[field];
            if (!value || !String(value).trim()) {
                throw new Error(`${field.replace(/_/g, " ")} is required.`);
            }
        }

        validateFieldLengths(data);

        const duplicate = await supplierRepository.findByCompanyName(
            companyId,
            data.company_name.trim()
        );

        if (duplicate) {
            throw new Error("A supplier with this company name already exists.");
        }

        // Reserves the slot atomically — same pattern as
        // customerService.create (see reserveCustomerSlot), extended to
        // suppliers for the first time here.
        await usageService.reserveSupplierSlot(companyId);

        let id;

        try {
            id = await supplierRepository.create({
                user_id: userId,
                company_id: companyId,
                company_name: data.company_name,
                email: data.email || "",
                phone: data.phone || "",
                billing_country: data.billing_country || "",
                billing_city: data.billing_city || "",
                trn: data.trn || "",
                notes: data.notes || "",
                source: data.source === "auto" ? "auto" : "manual",
                ...pickOptionalFields(data)
            });
        } catch (err) {
            await usageService.decrementSuppliers(companyId);
            throw err;
        }

        try {
            await auditLogRepository.create({
                userId,
                companyId,
                action: "supplier_created",
                module: "Supplier",
                status: "SUCCESS",
                description: `Supplier "${data.company_name}" created`,
            });
        } catch (logErr) {}

        return await supplierRepository.findById(id, companyId);
    }

    async getAll(companyId) {
        return await supplierRepository.findByCompany(companyId);
    }

    async update(id, companyId, data, userId = null) {

        const existing = await supplierRepository.findById(id, companyId);

        if (!existing) {
            throw new Error("Supplier not found.");
        }

        validateFieldLengths(data);

        const nextName = data.company_name ?? existing.company_name;

        if (nextName && nextName.trim()) {
            const duplicate = await supplierRepository.findByCompanyName(
                companyId,
                nextName.trim(),
                id
            );

            if (duplicate) {
                throw new Error("A supplier with this company name already exists.");
            }
        }

        const merged = {
            company_name: data.company_name ?? existing.company_name,
            email: data.email ?? existing.email,
            phone: data.phone ?? existing.phone,
            billing_country: data.billing_country ?? existing.billing_country,
            billing_city: data.billing_city ?? existing.billing_city,
            trn: data.trn ?? existing.trn,
            notes: data.notes ?? existing.notes,
            ...pickOptionalFields(data, existing)
        };

        await supplierRepository.update(id, companyId, merged);

        try {
            await auditLogRepository.create({
                userId,
                companyId,
                action: "supplier_updated",
                module: "Supplier",
                status: "SUCCESS",
                description: `Supplier "${merged.company_name}" updated`,
            });
        } catch (logErr) {}

        return await supplierRepository.findById(id, companyId);
    }

    async get(id, companyId) {

        const supplier = await supplierRepository.findById(id, companyId);

        if (!supplier) {
            throw new Error("Supplier not found.");
        }

        return supplier;

    }

    async updateStatus(id, companyId, status) {

        const existing = await supplierRepository.findById(id, companyId);

        if (!existing) {
            throw new Error("Supplier not found.");
        }

        await supplierRepository.updateStatus(id, companyId, status);

        return await supplierRepository.findById(id, companyId);
    }

    // Guards the Bill upload path — throws (with a 403 statusCode) if the
    // supplier has been deactivated, mirroring customerService.assertActive.
    async assertActive(id, companyId) {

        const supplier = await supplierRepository.findById(id, companyId);

        if (!supplier) {
            throw new Error("Supplier not found.");
        }

        if (supplier.status !== "ACTIVE") {
            const err = new Error(
                "This supplier is inactive. Please activate the supplier before adding documents."
            );
            err.statusCode = 403;
            throw err;
        }

        return supplier;
    }

    async delete(id, companyId, userId = null) {

        const supplier = await supplierRepository.findById(id, companyId);

        if (!supplier) {
            throw new Error("Supplier not found.");
        }

        await supplierRepository.delete(id, companyId);

        await usageService.decrementSuppliers(companyId);

        try {
            await auditLogRepository.create({
                userId,
                companyId,
                action: "supplier_deleted",
                module: "Supplier",
                status: "SUCCESS",
                description: `Supplier "${supplier.company_name}" deleted`,
            });
        } catch (logErr) {}

        return true;
    }
}

module.exports = new SupplierService();
