const adminRepository = require("../repositories/adminRepository");
const {
  calculateMonthlyRevenue,
  normalizePlan,
  VALID_PLANS,
  VALID_STATUSES,
} = require("../utils/plans");
const { hashPassword } = require("../utils/password");
const { fromDbStatus } = require("../utils/userStatus");
const subscriptionService = require("./subscriptionService");
const subscriptionRepository = require("../repositories/subscriptionRepository");
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
        monthlyRevenue: calculateMonthlyRevenue(platform.activeUsers),
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

    const clients = await adminRepository.getCustomerClients(id);
    const invoiceStats = await adminRepository.getCustomerInvoiceStats(id);

    return {
      customer: formatCustomer({
        ...customer,
        client_count: clients.length,
        invoice_count: invoiceStats.invoice_count,
        invoice_total: invoiceStats.invoice_total,
      }),
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

  async updateCustomer(id, data) {
    await this.getCustomerDetails(id);

    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim().toLowerCase();
    const company_name = String(data.company_name || "").trim();
    const phone = String(data.phone || "").trim();
    const country = String(data.country || "").trim();

    if (!name || !email || !company_name) {
      throw new Error("Name, email, and company are required.");
    }

    const existing = await adminRepository.getCustomerByEmail(email);

    if (existing && Number(existing.id) !== Number(id)) {
      throw new Error("Email already exists.");
    }

    await adminRepository.updateCustomer(id, {
      name,
      email,
      company_name,
      phone,
      country,
    });

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

  async updateCustomerPlan(userId, planId, billingCycle = "monthly") {

    const customer =
        await adminRepository.getCustomerById(userId);

    if (!customer) {
        throw new Error("Customer not found.");
    }

    const subscription =
        await subscriptionService.changePlan(
            userId,
            planId,
            billingCycle
        );

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
  };
}

function formatCustomer(row) {
  const totalClients = Number(row.client_count || 0);

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company_name: row.company_name,
    phone: row.phone || "",
    country: row.country || "",
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
