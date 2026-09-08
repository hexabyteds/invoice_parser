const adminRepository = require("../repositories/adminRepository");
const loginHistoryRepository = require("../repositories/loginHistoryRepository");
const {
  normalizePlan,
  VALID_PLANS,
  VALID_STATUSES,
} = require("../utils/plans");
const { hashPassword } = require("../utils/password");
const { fromDbStatus } = require("../utils/userStatus");
const subscriptionService = require("./subscriptionService");
const subscriptionRepository = require("../repositories/subscriptionRepository");
const companyRepository = require("../repositories/companyRepository");
const auditLogRepository = require("../repositories/auditLogRepository");
const userRepository = require("../repositories/userRepository");
const { validateCountryAndCode } = require("../utils/countries");
const { normalizeMobileNumber } = require("../utils/phone");
class AdminService {
  async getDashboardStats() {
    const platform = await adminRepository.getPlatformStats();
    const recentCustomers = await adminRepository.getRecentCustomers(5);
    const planDistribution = await adminRepository.getPlanDistribution();

    return {
      stats: {
        totalCustomers: platform.totalCustomers,
        activeSubscriptions: platform.activeSubscriptions,
        totalInvoices: platform.totalInvoices,
        monthlyRevenue: platform.monthlyRevenue,
        invoiceVolume: platform.invoiceVolume,
      },
      recentCustomers: recentCustomers.map(formatCustomer),
      planDistribution: formatPlanDistribution(planDistribution),
    };
  }

  async getCustomers({ limit, offset } = {}) {
    const [rows, total] = await Promise.all([
      adminRepository.getAllCustomers({ limit, offset }),
      adminRepository.countAllCustomers(),
    ]);

    return {
      customers: rows.map(formatCustomer),
      total,
    };
  }

  async getCustomerDetails(id) {
    const customer = await adminRepository.getCustomerById(id);

    if (!customer) {
      throw new Error("Customer not found.");
    }

    // A COMPANY account owns a workspace (its data lives there, shared
    // with its whole team); a FREELANCER owns none of its own and instead
    // shows up as a member of other companies. Surfacing both directions
    // is the whole point of an admin "investigate relationships" view —
    // see the Tenancy Ledger's Phase 4.
    const ownedCompany = await companyRepository.findByOwnerUserId(id);
    const memberOf = await companyRepository.findMembershipsForUser(id);

    const team = ownedCompany
      ? await companyRepository.findMembersForCompany(ownedCompany.id)
      : [];

    const companyId = ownedCompany?.id || null;
    const clients = await adminRepository.getCustomerClients(companyId);
    const invoiceStats = await adminRepository.getCustomerInvoiceStats(companyId);

    return {
      customer: formatCustomer({
        ...customer,
        client_count: clients.length,
        invoice_count: invoiceStats.invoice_count,
        invoice_total: invoiceStats.invoice_total,
      }),
      company: ownedCompany && {
        id: ownedCompany.id,
        name: ownedCompany.name,
        status: ownedCompany.status,
        team: team
          .filter((m) => m.role !== "OWNER")
          .map((m) => ({
            membership_id: m.id,
            user_id: m.user_id,
            name: m.name,
            email: m.email,
            role: m.role,
            status: m.status,
            permissions: m.permissions,
            invited_at: m.invited_at,
            accepted_at: m.accepted_at,
            removed_at: m.removed_at,
          })),
      },
      memberOf: memberOf.map((m) => ({
        membership_id: m.id,
        company_id: m.company_id,
        company_name: m.company_name,
        company_status: m.company_status,
        role: m.role,
        status: m.status,
        invited_at: m.invited_at,
        accepted_at: m.accepted_at,
      })),
      clients: clients.map((client) => ({
        id: client.id,
        company_name: client.company_name,
        contact_person: client.contact_person,
        email: client.email,
        phone: client.phone,
        country: client.country,
        city: client.city,
        invoice_count: Number(client.invoice_count || 0),
      })),
      invoiceStats,
    };
  }

  async getCustomerLoginHistory(id) {
    const customer = await adminRepository.getCustomerById(id);

    if (!customer) {
      throw new Error("Customer not found.");
    }

    return await loginHistoryRepository.findByUserId(id, 50);
  }

  async updateCustomer(id, data) {
    await this.getCustomerDetails(id);

    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim().toLowerCase();
    const company_name = String(data.company_name || "").trim();
    const phone = String(data.phone || "").trim();

    if (!name || !email || !company_name) {
      throw new Error("Name, email, and company are required.");
    }

    const existing = await adminRepository.getCustomerByEmail(email);

    if (existing && Number(existing.id) !== Number(id)) {
      throw new Error("Email already exists.");
    }

    const update = { name, email, company_name, phone };

    // country/country_code/mobile_number are optional here (same as the
    // customer's own profile edit) — only validate/write them when the
    // caller actually touched one, so an admin editing just the name
    // doesn't need to resend a customer's existing phone details.
    const touchesContactFields =
      data.country !== undefined ||
      data.country_code !== undefined ||
      data.mobile_number !== undefined;

    if (touchesContactFields) {
      const { country, countryCode } = validateCountryAndCode(
        data.country,
        data.country_code
      );
      const mobileNumber = normalizeMobileNumber(countryCode, data.mobile_number);

      const existingMobile = await userRepository.findByCountryCodeAndMobile(
        countryCode,
        mobileNumber,
        id
      );

      if (existingMobile) {
        throw new Error("An account with this mobile number already exists.");
      }

      update.country = country;
      update.country_code = countryCode;
      update.mobile_number = mobileNumber;
    }

    await adminRepository.updateCustomer(id, update);

    return formatCustomer(await adminRepository.getCustomerById(id));
  }

  async updateCustomerStatus(id, status) {
    await this.getCustomerDetails(id);

    const normalized = String(status || "").toLowerCase();

    if (!VALID_STATUSES.includes(normalized)) {
      throw new Error("Status must be active or suspended.");
    }

    await adminRepository.updateCustomerStatus(id, normalized);

    return `Customer ${normalized === "active" ? "activated" : "suspended"} successfully.`;
  }

  // async updateCustomerPlan(id, plan) {
  //   await this.getCustomerDetails(id);

  //   const normalized = normalizePlan(plan);

  //   if (!VALID_PLANS.includes(normalized)) {
  //     throw new Error("Invalid subscription plan.");
  //   }

  //   await adminRepository.updateCustomerPlan(id, normalized);

  //   return "Subscription plan updated successfully.";
  // }

  async updateCustomerPlan(userId, planId, billingCycle = "monthly", adminUserId = null) {

    const customer =
        await adminRepository.getCustomerById(userId);

    if (!customer) {
        throw new Error("Customer not found.");
    }

    const company = await companyRepository.findByOwnerUserId(userId);

    if (!company) {
        throw new Error("This customer does not own a company.");
    }

    const subscription =
        await subscriptionService.changePlan(
            company.id,
            planId,
            billingCycle
        );

    // subscriptionService.changePlan already logs a "plan_changed" event
    // attributed to the company owner — this second entry distinguishes
    // that it was an admin-initiated override (spec's Admin event category).
    try {
        await auditLogRepository.create({
            userId: adminUserId,
            companyId: company.id,
            action: "plan_changed_by_admin",
            module: "Admin",
            status: "SUCCESS",
            description: `Plan changed for "${company.name}" by Super Admin`,
        });
    } catch (logErr) {}

    return subscription;
}

  async resetCustomerPassword(id, password) {
    await this.getCustomerDetails(id);

    const nextPassword = String(password || "").trim();

    if (nextPassword.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    const hash = await hashPassword(nextPassword);
    await adminRepository.updatePassword(id, hash);

    return "Password reset successfully.";
  }

  async deleteCustomer(id) {
    await this.getCustomerDetails(id);
    await adminRepository.softDeleteCustomer(id);

    return "Customer deleted successfully.";
  }

  async getSubscriptions() {
    const rows = await subscriptionRepository.getAllSubscriptions();
    return rows.map(formatSubscription);
  }
}

function formatSubscription(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    company_id: row.company_id,
    plan_id: row.plan_id,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    company_name: row.company_name || "—",
    plan_name: row.plan_name,
    plan_slug: row.plan_slug,
    billing_cycle: row.billing_cycle,
    price: Number(row.price || 0),
    status: row.status,
    starts_at: row.starts_at,
    expires_at: row.expires_at,
    next_billing: row.next_billing,
    cancelled_at: row.cancelled_at,
    created_at: row.created_at,
    // Without these, an admin has no way to tell a subscription is
    // scheduled to cancel at period end — it just looks like a normal
    // active subscription (BUG-BILLING-002).
    cancel_at_period_end: Boolean(row.cancel_at_period_end),
    stripe_status: row.stripe_status,
  };
}

function formatCustomer(row) {
  const totalClients = Number(row.client_count || 0);

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company_name: row.company_name,
    account_type: row.account_type,
    phone: row.phone || "",
    country: row.country || "",
    country_code: row.country_code || "",
    mobile_number: row.mobile_number || "",
    email_verified: Boolean(row.email_verified),
    plan: row.plan || "starter",
    status: fromDbStatus(row.status, row.deleted_at),
    created_at: row.created_at,
    client_count: totalClients,
    total_clients: totalClients,
    invoice_count: Number(row.invoice_count || 0),
    invoice_total: Number(row.invoice_total || 0),
  };
}

function formatPlanDistribution(rows) {
  return rows.map((row) => ({
    plan: row.plan,
    count: Number(row.count || 0),
  }));
}

module.exports = new AdminService();
