const adminCompanyRepository = require("../repositories/adminCompanyRepository");
const companyRepository = require("../repositories/companyRepository");
const usageService = require("../services/usageService");
const auditLogRepository = require("../repositories/auditLogRepository");

const VALID_STATUSES = ["ACTIVE", "SUSPENDED", "DEACTIVATED"];

function companyCode(id) {
  return `CMP-${String(id).padStart(6, "0")}`;
}

function formatListRow(row) {
  return {
    id: row.id,
    code: companyCode(row.id),
    name: row.name,
    legalName: row.legal_name,
    status: row.status,
    createdAt: row.created_at,
    email: row.email,
    phone: row.phone,
    trn: row.trn,
    createdBy: row.owner_account_type,
    freelancer:
      row.owner_account_type === "FREELANCER"
        ? { id: row.owner_id, name: row.owner_name, email: row.owner_email }
        : null,
    plan: row.plan_name || "—",
    planSlug: row.plan_slug || null,
    usage: {
      customers: Number(row.customers_count || 0),
      suppliers: Number(row.suppliers_count || 0),
      invoices: Number(row.invoices_count || 0),
      bills: Number(row.bills_count || 0),
      bankStatements: Number(row.bank_statements_count || 0),
      ratio: Number(row.usage_ratio || 0),
    },
    lastActivity: row.last_activity,
  };
}

function healthOf({ status, usageRatio, subscriptionStatus }) {
  if (status !== "ACTIVE") return "Suspended";
  if (subscriptionStatus && subscriptionStatus !== "active") return "Payment Issue";
  if (usageRatio >= 1) return "Limit Reached";
  if (usageRatio >= 0.7) return "Near Usage Limit";
  return "Healthy";
}

class AdminCompanyService {
  async getSummary() {
    return await adminCompanyRepository.getSummary();
  }

  async getCompanies({ limit = 20, offset = 0, ...filters } = {}) {
    const [rows, total] = await Promise.all([
      adminCompanyRepository.getAll({ limit, offset, ...filters }),
      adminCompanyRepository.countAll(filters),
    ]);

    return {
      companies: rows.map(formatListRow),
      total,
    };
  }

  async getCompanyDetails(companyId) {
    const row = await adminCompanyRepository.getById(companyId);

    if (!row) {
      throw new Error("Company not found.");
    }

    const [businessData, otherCompanies, lastLogin, teamRows] = await Promise.all([
      adminCompanyRepository.getBusinessDataCounts(companyId),
      row.owner_account_type === "FREELANCER"
        ? adminCompanyRepository.getFreelancerOtherCompanies(row.owner_id, companyId)
        : Promise.resolve([]),
      adminCompanyRepository.getLastLogin(row.owner_id),
      companyRepository.findMembersForCompany(companyId),
    ]);

    // Reuses the exact same dynamic Free/Pro/Max resolution every other
    // part of the app uses (usageService.getUsage) — never a hand-rolled
    // copy of plan limits here, per the spec's explicit instruction.
    const usage = await usageService.getUsage(companyId);

    const usageRatio = Math.max(
      usage.usage.customers.limit === null ? 0 : usage.usage.customers.used / Math.max(usage.usage.customers.limit, 1),
      usage.usage.suppliers.limit === null ? 0 : usage.usage.suppliers.used / Math.max(usage.usage.suppliers.limit, 1),
      usage.usage.invoices.limit === null ? 0 : usage.usage.invoices.used / Math.max(usage.usage.invoices.limit, 1)
    );

    return {
      company: {
        id: row.id,
        code: companyCode(row.id),
        name: row.name,
        legalName: row.legal_name,
        status: row.status,
        createdAt: row.created_at,
        email: row.email,
        phone: row.phone,
        address: row.address,
        trn: row.trn,
        health: healthOf({
          status: row.status,
          usageRatio,
          subscriptionStatus: row.subscription_status,
        }),
      },
      account: {
        type: row.owner_account_type === "FREELANCER" ? "Freelancer-created / Freelancer-managed" : "Direct Company Account",
        plan: row.plan_name || "—",
        planSlug: row.plan_slug || null,
        subscriptionStatus: row.subscription_status || "—",
        createdBy: row.owner_account_type,
        owner: { id: row.owner_id, name: row.owner_name, email: row.owner_email },
        managingFreelancer:
          row.owner_account_type === "FREELANCER"
            ? { id: row.owner_id, name: row.owner_name, email: row.owner_email }
            : null,
        lastLogin,
      },
      freelancerOtherCompanies: otherCompanies,
      team: teamRows
        .filter((m) => m.role !== "OWNER")
        .map((m) => ({
          membershipId: m.id,
          userId: m.user_id,
          name: m.name,
          email: m.email,
          role: m.role,
          status: m.status,
          invitedAt: m.invited_at,
          acceptedAt: m.accepted_at,
          removedAt: m.removed_at,
        })),
      businessData: {
        customers: Number(businessData.customers_count || 0),
        suppliers: Number(businessData.suppliers_count || 0),
        invoices: Number(businessData.invoices_count || 0),
        bills: Number(businessData.bills_count || 0),
        bankStatements: Number(businessData.bank_statements_count || 0),
      },
      usage,
      billing: {
        plan: row.plan_name || "—",
        billingCycle: row.billing_cycle,
        status: row.subscription_status,
        startsAt: row.starts_at,
        nextBilling: row.next_billing,
        price: row.price === null ? null : Number(row.price),
        cancelledAt: row.cancelled_at,
        cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
        stripeStatus: row.stripe_status,
      },
    };
  }

  async getActivity(companyId) {
    await this.assertExists(companyId);
    return await adminCompanyRepository.getActivity(companyId);
  }

  async updateStatus(companyId, status, adminUserId = null) {
    const company = await this.assertExists(companyId);

    const normalized = String(status || "").toUpperCase();

    if (!VALID_STATUSES.includes(normalized)) {
      throw new Error(`Status must be one of: ${VALID_STATUSES.join(", ")}.`);
    }

    await companyRepository.updateStatus(companyId, normalized);

    try {
      await auditLogRepository.create({
        userId: adminUserId,
        companyId,
        action: "company_status_changed",
        module: "Admin",
        status: "SUCCESS",
        description: `"${company.name}" status changed from ${company.status} to ${normalized} by Super Admin`,
      });
    } catch (logErr) {}

    return normalized;
  }

  async assertExists(companyId) {
    const row = await adminCompanyRepository.getById(companyId);

    if (!row) {
      throw new Error("Company not found.");
    }

    return row;
  }
}

module.exports = new AdminCompanyService();
