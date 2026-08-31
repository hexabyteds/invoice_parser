const db = require("../config/database");

// An untouched number/date input in the form submits "" rather than
// omitting the field — MySQL rejects "" outright for DECIMAL/DATE columns
// (opening_balance / opening_balance_date), so treat blank as absent.
function blankToNull(value) {
    return value === "" || value === undefined ? null : value;
}

class CustomerRepository {

    // Every read/write here is scoped by company_id — a customer belongs
    // to the company, not to whoever created it, same rule as invoices and
    // bank statements. user_id is still recorded on the row (create) for
    // attribution only.

    async create(customer) {

        const sql = `
            INSERT INTO customers
(
    user_id,
    company_id,
    company_name,
    contact_person,
    email,
    phone,
    trn,
    address,
    country,
    city,
    notes,
    salutation,
    primary_contact_first_name,
    primary_contact_last_name,
    display_name,
    customer_type,
    mobile,
    website,
    department,
    designation,
    tax_treatment,
    place_of_supply,
    currency,
    payment_terms,
    opening_balance,
    opening_balance_date,
    billing_attention,
    billing_country,
    billing_address_line1,
    billing_address_line2,
    billing_city,
    billing_state,
    billing_postal_code,
    billing_phone,
    shipping_attention,
    shipping_country,
    shipping_address_line1,
    shipping_address_line2,
    shipping_city,
    shipping_state,
    shipping_postal_code,
    shipping_phone,
    customer_category,
    customer_segment,
    risk,
    approval_status,
    portal_access,
    portal_language,
    salesperson,
    account_manager,
    cost_centre,
    source
)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `;

        const values = [
            customer.user_id,
            customer.company_id,
            customer.company_name,
            customer.contact_person,
            customer.email,
            customer.phone,
            customer.trn,
            customer.address,
            customer.country,
            customer.city,
            customer.notes,
            customer.salutation,
            customer.primary_contact_first_name,
            customer.primary_contact_last_name,
            customer.display_name,
            customer.customer_type,
            customer.mobile,
            customer.website,
            customer.department,
            customer.designation,
            customer.tax_treatment,
            customer.place_of_supply,
            customer.currency,
            customer.payment_terms,
            blankToNull(customer.opening_balance),
            blankToNull(customer.opening_balance_date),
            customer.billing_attention,
            customer.billing_country,
            customer.billing_address_line1,
            customer.billing_address_line2,
            customer.billing_city,
            customer.billing_state,
            customer.billing_postal_code,
            customer.billing_phone,
            customer.shipping_attention,
            customer.shipping_country,
            customer.shipping_address_line1,
            customer.shipping_address_line2,
            customer.shipping_city,
            customer.shipping_state,
            customer.shipping_postal_code,
            customer.shipping_phone,
            customer.customer_category,
            customer.customer_segment,
            customer.risk,
            customer.approval_status,
            customer.portal_access,
            customer.portal_language,
            customer.salesperson,
            customer.account_manager,
            customer.cost_centre,
            customer.source || "manual"
        ];

        const [result] = await db.execute(sql, values);
        return result.insertId;
    }

    async findByTrn(companyId, trn) {

        const [rows] = await db.execute(
            `SELECT * FROM customers WHERE company_id = ? AND trn = ? AND trn != '' LIMIT 1`,
            [companyId, trn]
        );

        return rows[0];
    }

    async findByCompany(companyId) {

        const sql = `
            SELECT *
            FROM customers
            WHERE company_id=?
            ORDER BY company_name
        `;
        const values = [companyId];
        const [result] = await db.execute(sql, values);
        return result;
    }

    async findByCompanyName(companyId, companyName, excludeId = null) {

        const sql = excludeId
            ? `SELECT id FROM customers WHERE company_id = ? AND LOWER(company_name) = LOWER(?) AND id != ? LIMIT 1`
            : `SELECT id FROM customers WHERE company_id = ? AND LOWER(company_name) = LOWER(?) LIMIT 1`;

        const values = excludeId
            ? [companyId, companyName, excludeId]
            : [companyId, companyName];

        const [rows] = await db.execute(sql, values);
        return rows[0];
    }

    async countByCompany(companyId) {

        const [rows] = await db.execute(
            `SELECT COUNT(*) AS total FROM customers WHERE company_id = ?`,
            [companyId]
        );

        return Number(rows[0]?.total || 0);
    }

    async update(id, companyId, customer) {

        const [result] = await db.execute(`
            UPDATE customers
            SET
                company_name=?,
                contact_person=?,
                email=?,
                phone=?,
                trn=?,
                address=?,
                country=?,
                city=?,
                notes=?,
                salutation=?,
                primary_contact_first_name=?,
                primary_contact_last_name=?,
                display_name=?,
                customer_type=?,
                mobile=?,
                website=?,
                department=?,
                designation=?,
                tax_treatment=?,
                place_of_supply=?,
                currency=?,
                payment_terms=?,
                opening_balance=?,
                opening_balance_date=?,
                billing_attention=?,
                billing_country=?,
                billing_address_line1=?,
                billing_address_line2=?,
                billing_city=?,
                billing_state=?,
                billing_postal_code=?,
                billing_phone=?,
                shipping_attention=?,
                shipping_country=?,
                shipping_address_line1=?,
                shipping_address_line2=?,
                shipping_city=?,
                shipping_state=?,
                shipping_postal_code=?,
                shipping_phone=?,
                customer_category=?,
                customer_segment=?,
                risk=?,
                approval_status=?,
                portal_access=?,
                portal_language=?,
                salesperson=?,
                account_manager=?,
                cost_centre=?
            WHERE id=?
            AND company_id=?
        `, [
            customer.company_name,
            customer.contact_person,
            customer.email,
            customer.phone,
            customer.trn,
            customer.address,
            customer.country,
            customer.city,
            customer.notes,
            customer.salutation,
            customer.primary_contact_first_name,
            customer.primary_contact_last_name,
            customer.display_name,
            customer.customer_type,
            customer.mobile,
            customer.website,
            customer.department,
            customer.designation,
            customer.tax_treatment,
            customer.place_of_supply,
            customer.currency,
            customer.payment_terms,
            blankToNull(customer.opening_balance),
            blankToNull(customer.opening_balance_date),
            customer.billing_attention,
            customer.billing_country,
            customer.billing_address_line1,
            customer.billing_address_line2,
            customer.billing_city,
            customer.billing_state,
            customer.billing_postal_code,
            customer.billing_phone,
            customer.shipping_attention,
            customer.shipping_country,
            customer.shipping_address_line1,
            customer.shipping_address_line2,
            customer.shipping_city,
            customer.shipping_state,
            customer.shipping_postal_code,
            customer.shipping_phone,
            customer.customer_category,
            customer.customer_segment,
            customer.risk,
            customer.approval_status,
            customer.portal_access,
            customer.portal_language,
            customer.salesperson,
            customer.account_manager,
            customer.cost_centre,
            id,
            companyId
        ]);

        return result.affectedRows;
    }

    async updateStatus(id, companyId, status) {

        const [result] = await db.execute(
            `UPDATE customers SET status=? WHERE id=? AND company_id=?`,
            [status, id, companyId]
        );

        return result.affectedRows;
    }

    async delete(id, companyId) {

        const [result] = await db.execute(
            `DELETE FROM customers WHERE id=? AND company_id=?`,
            [id, companyId]
        );

        return result.affectedRows;

    }

    async findById(id, companyId) {

        const [rows] = await db.execute(
            `
            SELECT *
            FROM customers
            WHERE id = ?
            AND company_id = ?
            LIMIT 1
            `,
            [id, companyId]
        );

        return rows[0];

    }

}

module.exports = new CustomerRepository();
