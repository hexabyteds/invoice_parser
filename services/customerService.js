const customerRepository = require("../repositories/customerRepository");
const usageService = require("./usageService");
const auditLogRepository = require("../repositories/auditLogRepository");

// Matches the actual VARCHAR(n) size of each column in the `customers`
// table (db/schema.sql) — exceeding it used to reach the DB and come back
// as a raw "Data too long for column '...'" MySQL error instead of a
// clean validation error. `address`/`notes` are TEXT columns (64KB+) and
// don't need a practical limit.
const FIELD_MAX_LENGTHS = {
    company_name: 255,
    contact_person: 150,
    email: 255,
    phone: 30,
    trn: 100,
    country: 100,
    city: 100,
    salutation: 20,
    primary_contact_first_name: 150,
    primary_contact_last_name: 150,
    display_name: 255,
    customer_type: 50,
    mobile: 30,
    website: 255,
    department: 150,
    designation: 150,
    tax_treatment: 50,
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
    customer_category: 100,
    customer_segment: 100,
    risk: 50,
    approval_status: 50,
    portal_language: 50,
    salesperson: 150,
    account_manager: 150,
    cost_centre: 100,
};

// Optional new Zoho-parity fields (everything not in this list is required
// exactly as before create/update always were).
const OPTIONAL_FIELDS = Object.keys(FIELD_MAX_LENGTHS).filter(
    (f) => !["company_name", "contact_person", "email", "phone", "trn", "country", "city"].includes(f)
).concat(["opening_balance", "opening_balance_date", "portal_access"]);

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

class CustomerService {

    // A customer belongs to the company (companyId) — userId is only kept
    // for audit attribution.
    async create(companyId, userId, data) {
        if (!data.company_name || !data.company_name.trim()) {
            throw new Error("Company name is required.");
        }

        validateFieldLengths(data);

        const duplicate = await customerRepository.findByCompanyName(
            companyId,
            data.company_name.trim()
        );

        if (duplicate) {
            throw new Error("A customer with this company name already exists.");
        }

        // Reserves the slot atomically — under concurrent requests, the old
        // checkCustomerLimit()-then-incrementCustomers() pair let every request
        // read the same pre-increment count and all pass, so N concurrent
        // requests near the limit could all succeed past it.
        await usageService.reserveCustomerSlot(companyId);

        let id;

        try {
            id = await customerRepository.create({
                user_id: userId,
                company_id: companyId,
                company_name: data.company_name,
                contact_person: data.contact_person || "",
                email: data.email || "",
                phone: data.phone || "",
                trn: data.trn || "",
                address: data.address || "",
                country: data.country || "",
                city: data.city || "",
                notes: data.notes || "",
                ...pickOptionalFields(data)
            });
        } catch (err) {
            // Creation failed after the slot was reserved — release it.
            await usageService.decrementCustomers(companyId);
            throw err;
        }

        // Activity feed is a nice-to-have — never let logging break customer creation.
        try {
            await auditLogRepository.create({
                userId,
                companyId,
                customerId: id,
                action: "client_added",
                module: "Customer",
                status: "SUCCESS",
                description: `Customer "${data.company_name}" created`,
            });
        } catch (err) {
            // ignore
        }

        return await customerRepository.findById(id, companyId);
    }

    async getAll(companyId) {
        return await customerRepository.findByCompany(companyId);
    }

    async update(id, companyId, data, userId = null) {

        const existing = await customerRepository.findById(id, companyId);

        if (!existing) {
            throw new Error("Customer not found.");
        }

        validateFieldLengths(data);

        const nextName = data.company_name ?? existing.company_name;

        if (nextName && nextName.trim()) {
            const duplicate = await customerRepository.findByCompanyName(
                companyId,
                nextName.trim(),
                id
            );

            if (duplicate) {
                throw new Error("A customer with this company name already exists.");
            }
        }

        const merged = {
            company_name: data.company_name ?? existing.company_name,
            contact_person: data.contact_person ?? existing.contact_person,
            email: data.email ?? existing.email,
            phone: data.phone ?? existing.phone,
            trn: data.trn ?? existing.trn,
            address: data.address ?? existing.address,
            country: data.country ?? existing.country,
            city: data.city ?? existing.city,
            notes: data.notes ?? existing.notes,
            ...pickOptionalFields(data, existing)
        };

        await customerRepository.update(id, companyId, merged);

        try {
            await auditLogRepository.create({
                userId,
                companyId,
                customerId: id,
                action: "customer_updated",
                module: "Customer",
                status: "SUCCESS",
                description: `Customer "${merged.company_name}" updated`,
            });
        } catch (logErr) {}

        return await customerRepository.findById(id, companyId);
    }

    async get(id, companyId) {

        const customer = await customerRepository.findById(id, companyId);

        if (!customer) {
            throw new Error("Customer not found.");
        }

        return customer;

    }

    async updateStatus(id, companyId, status) {

        const existing = await customerRepository.findById(id, companyId);

        if (!existing) {
            throw new Error("Customer not found.");
        }

        await customerRepository.updateStatus(id, companyId, status);

        return await customerRepository.findById(id, companyId);
    }

    // Guards the invoice/document creation path — throws (with a 403
    // statusCode) if the customer has been deactivated, so a stale upload
    // form or a direct API call can't add documents to it.
    async assertActive(id, companyId) {

        const customer = await customerRepository.findById(id, companyId);

        if (!customer) {
            throw new Error("Customer not found.");
        }

        if (customer.status !== "ACTIVE") {
            const err = new Error(
                "This customer is inactive. Please activate the customer before adding documents."
            );
            err.statusCode = 403;
            throw err;
        }

        return customer;
    }

    async delete(id, companyId, userId = null) {

        const customer = await customerRepository.findById(id, companyId);

        if (!customer) {
            throw new Error("Customer not found.");
        }

        await customerRepository.delete(id, companyId);

        await usageService.decrementCustomers(companyId);

        try {
            await auditLogRepository.create({
                userId,
                companyId,
                action: "customer_deleted",
                module: "Customer",
                status: "SUCCESS",
                description: `Customer "${customer.company_name}" deleted`,
            });
        } catch (logErr) {}

        return true;
    }
}

module.exports = new CustomerService();
