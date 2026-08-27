const planRepository = require("../repositories/planRepository");
const planLimitsRepository = require("../repositories/planLimitsRepository");

// Neither field is ever required from the admin form — omitting one (or
// sending it explicitly as null/empty) means Unlimited, never an implicit
// 0. Companies is only meaningful for the Freelancer side (a Company
// account's own company count is always exactly 1, enforced structurally
// elsewhere) — normalized to null on the Company side regardless of what's
// posted, so it's never accidentally read.
function normalizeLimit(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeLimits(limits = {}) {
  return {
    company: {
      companies_limit: null,
      customers_limit: normalizeLimit(limits.company?.customers_limit),
      suppliers_limit: normalizeLimit(limits.company?.suppliers_limit),
      invoices_limit: normalizeLimit(limits.company?.invoices_limit),
    },
    freelancer: {
      companies_limit: normalizeLimit(limits.freelancer?.companies_limit),
      customers_limit: normalizeLimit(limits.freelancer?.customers_limit),
      suppliers_limit: normalizeLimit(limits.freelancer?.suppliers_limit),
      invoices_limit: normalizeLimit(limits.freelancer?.invoices_limit),
    },
  };
}

async function attachLimits(plan) {
  if (!plan) return plan;

  const rows = await planLimitsRepository.getAllForPlan(plan.id);
  const company = rows.find((r) => r.account_type === "COMPANY") || null;
  const freelancer = rows.find((r) => r.account_type === "FREELANCER") || null;

  return {
    ...plan,
    limits: {
      company: company && {
        customers_limit: company.customers_limit,
        suppliers_limit: company.suppliers_limit,
        invoices_limit: company.invoices_limit,
      },
      freelancer: freelancer && {
        companies_limit: freelancer.companies_limit,
        customers_limit: freelancer.customers_limit,
        suppliers_limit: freelancer.suppliers_limit,
        invoices_limit: freelancer.invoices_limit,
      },
    },
  };
}

class PlanService {

  async getPlans() {
    const plans = await planRepository.getAllPlans();
    return Promise.all(plans.map(attachLimits));
  }

  async getPlan(id) {

    const plan = await planRepository.getPlanById(id);

    if (!plan) {
      throw new Error("Plan not found.");
    }

    return await attachLimits(plan);
  }
  async getActivePlans() {

    const plans = await planRepository.getActivePlans();
    return Promise.all(plans.map(attachLimits));

}
  async createPlan(data) {

    const existing = await planRepository.getPlanBySlug(data.slug);

    if (existing) {
      throw new Error("Plan slug already exists.");
    }

    const id = await planRepository.createPlan(data);

    // Always seed both rows for a brand-new plan (defaulting to Unlimited
    // if the caller sent none) — every plan needs plan_limits rows to
    // resolve correctly, unlike updatePlan below where omitting `limits`
    // means "leave the existing configuration alone".
    await planLimitsRepository.upsertForPlan(id, normalizeLimits(data.limits));

    return await this.getPlan(id);
  }

  async updatePlan(id, data) {

    const plan = await planRepository.getPlanById(id);

    if (!plan) {
      throw new Error("Plan not found.");
    }

    const existing = await planRepository.getPlanBySlug(data.slug);

    if (existing && existing.id != id) {
      throw new Error("Plan slug already exists.");
    }

    await planRepository.updatePlan(id, data);

    // Only touch plan_limits if the caller actually sent them — an update
    // that only changes price/name (or predates this feature) must never
    // silently wipe out an existing Company/Freelancer limit configuration
    // back to Unlimited.
    if (data.limits) {
      await planLimitsRepository.upsertForPlan(id, normalizeLimits(data.limits));
    }

    return await this.getPlan(id);
  }

  async changeStatus(id, active) {

    const plan = await planRepository.getPlanById(id);

    if (!plan) {
      throw new Error("Plan not found.");
    }

    // Prevent disabling Free plan
    if (plan.slug === "free" && !active) {
      throw new Error("Free plan cannot be disabled.");
    }

    await planRepository.updateStatus(id, active);

    return "Plan updated successfully.";
  }

  async deletePlan(id) {

    const plan = await planRepository.getPlanById(id);

    if (!plan) {
      throw new Error("Plan not found.");
    }

    // Never delete Free plan
    if (plan.slug === "free") {
      throw new Error("Free plan cannot be deleted.");
    }

    // Check if customers are using this plan
    const inUse = await planRepository.isPlanInUse(id);

    if (inUse) {
      throw new Error("Plan is assigned to customers.");
    }

    await planRepository.deletePlan(id);

    return "Plan deleted successfully.";
  }

}

module.exports = new PlanService();