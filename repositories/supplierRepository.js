const db = require("../config/database");

// An untouched number/date input in the form submits "" rather than
// omitting the field — MySQL rejects "" outright for DECIMAL/DATE columns
// (opening_balance / opening_balance_date), so treat blank as absent.
function blankToNull(value) {
    return value === "" || value === undefined ? null : value;
}

class SupplierRepository {

    // Every read/write here is scoped by company_id — a supplier belongs
    // to the company, not to whoever created it, same rule as customers,
    // invoices and bank statements. user_id is still recorded on the row
    // (create) for attribution only.

    async create(supplier) {

        const sql = `
            INSERT INTO suppliers
(
    user_id,
    company_id,
    vendor_type,
    salutation,
    primary_contact_first_name,
    primary_contact_last_name,
    company_name,
    display_name,
    email,
    phone,
    mobile,
    website,
    department,
    designation,
    tax_treatment,
    trn,
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
    vendor_category,
    vendor_classification,
    procurement_category,
    default_expense_account,
    notes
)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `;

        const values = [
            supplier.user_id,
            supplier.company_id,
            supplier.vendor_type,
            supplier.salutation,
            supplier.primary_contact_first_name,
            supplier.primary_contact_last_name,
            supplier.company_name,
            supplier.display_name,
            supplier.email,
            supplier.phone,
            supplier.mobile,
            supplier.website,
            supplier.department,
            supplier.designation,
            supplier.tax_treatment,
            supplier.trn,
            supplier.place_of_supply,
            supplier.currency,
            supplier.payment_terms,
            blankToNull(supplier.opening_balance),
            blankToNull(supplier.opening_balance_date),
            supplier.billing_attention,
            supplier.billing_country,
            supplier.billing_address_line1,
            supplier.billing_address_line2,
            supplier.billing_city,
            supplier.billing_state,
            supplier.billing_postal_code,
            supplier.billing_phone,
            supplier.shipping_attention,
            supplier.shipping_country,
            supplier.shipping_address_line1,
            supplier.shipping_address_line2,
            supplier.shipping_city,
            supplier.shipping_state,
            supplier.shipping_postal_code,
            supplier.shipping_phone,
            supplier.vendor_category,
            supplier.vendor_classification,
            supplier.procurement_category,
            supplier.default_expense_account,
            supplier.notes
        ];

        const [result] = await db.execute(sql, values);
        return result.insertId;
    }

    async findByCompany(companyId) {

        const sql = `
            SELECT *
            FROM suppliers
            WHERE company_id=?
            ORDER BY company_name
        `;
        const values = [companyId];
        const [result] = await db.execute(sql, values);
        return result;
    }

    async findByCompanyName(companyId, companyName, excludeId = null) {

        const sql = excludeId
            ? `SELECT id FROM suppliers WHERE company_id = ? AND LOWER(company_name) = LOWER(?) AND id != ? LIMIT 1`
            : `SELECT id FROM suppliers WHERE company_id = ? AND LOWER(company_name) = LOWER(?) LIMIT 1`;

        const values = excludeId
            ? [companyId, companyName, excludeId]
            : [companyId, companyName];

        const [rows] = await db.execute(sql, values);
        return rows[0];
    }

    async countByCompany(companyId) {

        const [rows] = await db.execute(
            `SELECT COUNT(*) AS total FROM suppliers WHERE company_id = ?`,
            [companyId]
        );

        return Number(rows[0]?.total || 0);
    }

    async update(id, companyId, supplier) {

        const [result] = await db.execute(`
            UPDATE suppliers
            SET
                vendor_type=?,
                salutation=?,
                primary_contact_first_name=?,
                primary_contact_last_name=?,
                company_name=?,
                display_name=?,
                email=?,
                phone=?,
                mobile=?,
                website=?,
                department=?,
                designation=?,
                tax_treatment=?,
                trn=?,
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
                vendor_category=?,
                vendor_classification=?,
                procurement_category=?,
                default_expense_account=?,
                notes=?
            WHERE id=?
            AND company_id=?
        `, [
            supplier.vendor_type,
            supplier.salutation,
            supplier.primary_contact_first_name,
            supplier.primary_contact_last_name,
            supplier.company_name,
            supplier.display_name,
            supplier.email,
            supplier.phone,
            supplier.mobile,
            supplier.website,
            supplier.department,
            supplier.designation,
            supplier.tax_treatment,
            supplier.trn,
            supplier.place_of_supply,
            supplier.currency,
            supplier.payment_terms,
            blankToNull(supplier.opening_balance),
            blankToNull(supplier.opening_balance_date),
            supplier.billing_attention,
            supplier.billing_country,
            supplier.billing_address_line1,
            supplier.billing_address_line2,
            supplier.billing_city,
            supplier.billing_state,
            supplier.billing_postal_code,
            supplier.billing_phone,
            supplier.shipping_attention,
            supplier.shipping_country,
            supplier.shipping_address_line1,
            supplier.shipping_address_line2,
            supplier.shipping_city,
            supplier.shipping_state,
            supplier.shipping_postal_code,
            supplier.shipping_phone,
            supplier.vendor_category,
            supplier.vendor_classification,
            supplier.procurement_category,
            supplier.default_expense_account,
            supplier.notes,
            id,
            companyId
        ]);

        return result.affectedRows;
    }

    async updateStatus(id, companyId, status) {

        const [result] = await db.execute(
            `UPDATE suppliers SET status=? WHERE id=? AND company_id=?`,
            [status, id, companyId]
        );

        return result.affectedRows;
    }

    async delete(id, companyId) {

        const [result] = await db.execute(
            `DELETE FROM suppliers WHERE id=? AND company_id=?`,
            [id, companyId]
        );

        return result.affectedRows;

    }

    async findById(id, companyId) {

        const [rows] = await db.execute(
            `
            SELECT *
            FROM suppliers
            WHERE id = ?
            AND company_id = ?
            LIMIT 1
            `,
            [id, companyId]
        );

        return rows[0];

    }

}

module.exports = new SupplierRepository();
