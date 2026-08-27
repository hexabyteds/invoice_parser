const usageRepository = require("../repositories/usageRepository");
const customerRepository = require("../repositories/customerRepository");
const supplierRepository = require("../repositories/supplierRepository");
const invoiceRepository = require("../repositories/invoiceRepository");
const companyRepository = require("../repositories/companyRepository");
const userRepository = require("../repositories/userRepository");
const planLimitsRepository = require("../repositories/planLimitsRepository");
const subscriptionService = require("./subscriptionService");

const BYTES_PER_MB = 1024 * 1024;

function storageLimitToBytes(limitMb) {
  return Number(limitMb || 0) * BYTES_PER_MB;
}

// limit === null means Unlimited — remaining is reported as null too
// (rather than Infinity, which doesn't survive JSON) so the frontend can
// render an infinity glyph/"Unlimited" instead of a number.
function remainingOf(used, limit) {
  if (limit === null || limit === undefined) return null;
  return Math.max(0, limit - used);
}

function metric(used, limit) {
  return {
    used,
    limit: limit === undefined ? null : limit,
    remaining: remainingOf(used, limit)
  };
}

// Merges a subscription's plan with its account-type-aware plan_limits row
// (see migrations/0021 + planLimitsRepository). Legacy plans predating this
// feature (Starter/Business/Enterprise — no plan_limits row) fall back to
// the plan's own flat customer_limit/invoice_limit columns unchanged;
// suppliers/companies were never capped before this feature existed, so
// they fall back to Unlimited (null) rather than inventing a number.
// storage/OCR/team limits are untouched by this feature — always read from
// the plan's own flat columns, same as before.
function buildLimits(subscription, accountType, planLimits) {
  return {
    id: subscription.plan_id,
    name: subscription.name,
    slug: subscription.slug,
    accountType,
    invoice_limit: planLimits ? planLimits.invoices_limit : subscription.invoice_limit,
    customer_limit: planLimits ? planLimits.customers_limit : subscription.customer_limit,
    supplier_limit: planLimits ? planLimits.suppliers_limit : null,
    companies_limit: planLimits ? planLimits.companies_limit : null,
    ocr_limit: subscription.ocr_limit,
    storage_limit: subscription.storage_limit,
    user_limit: subscription.user_limit,
  };
}

class UsageService {

  // Just the plan's limit numbers — no usage_stats reads/writes. Used by
  // the atomic reserve* methods below, which must NOT go through getUsage's
  // reconciliation (see reserveInvoiceSlot for why that combination is
  // unsafe under concurrency).
  //
  // Account-type-aware (spec's "Critical Architecture Rule"): a Company
  // account's own company always resolves against that company's own
  // subscription + plan_limits(COMPANY). A Freelancer-owned company
  // resolves against the Freelancer's own account-level subscription +
  // plan_limits(FREELANCER) instead — the plan tier is the Freelancer's,
  // applied uniformly to every company they own; only the *usage* stays
  // per-company (this company's own usage_stats row).
  async getPlanLimits(companyId) {

    const { subscription, accountType } =
      await subscriptionService.resolveSubscriptionForCompany(companyId);

    const planLimits = await planLimitsRepository.getForPlanAndAccountType(
      subscription.plan_id,
      accountType
    );

    return buildLimits(subscription, accountType, planLimits);

  }

  // The Freelancer's own plan limits, resolved directly from their user id
  // — used to gate company creation (there's no company yet at that point)
  // and to render the account-level "Companies: X/Y" usage indicator.
  async getFreelancerLimits(userId) {

    let subscription;

    try {
      subscription = await subscriptionService.getCurrentSubscriptionForUser(userId);
    } catch (error) {
      if (error.message === "No active subscription found.") {
        subscription = await subscriptionService.createFreeSubscriptionForUser(userId);
      } else {
        throw error;
      }
    }

    const planLimits = await planLimitsRepository.getForPlanAndAccountType(
      subscription.plan_id,
      "FREELANCER"
    );

    return buildLimits(subscription, "FREELANCER", planLimits);

  }

  async getUsage(companyId) {

    let usage = await usageRepository.getByCompanyId(companyId);

    // Create usage record automatically if missing
    if (!usage) {
      await usageRepository.create(companyId);
      usage = await usageRepository.getByCompanyId(companyId);
    }

    const plan = await this.getPlanLimits(companyId);

    const actualCustomers = await customerRepository.countByCompany(companyId);
    const actualSuppliers = await supplierRepository.countByCompany(companyId);
    const actualInvoices = await invoiceRepository.countByCompany(companyId);

    if (usage.customers_used !== actualCustomers) {
      await usageRepository.updateCustomers(companyId, actualCustomers);
      usage.customers_used = actualCustomers;
    }

    if (usage.suppliers_used !== actualSuppliers) {
      await usageRepository.updateSuppliers(companyId, actualSuppliers);
      usage.suppliers_used = actualSuppliers;
    }

    if (usage.invoices_used !== actualInvoices) {
      await usageRepository.updateInvoices(companyId, actualInvoices);
      usage.invoices_used = actualInvoices;
    }

    const result = {

      plan: {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        accountType: plan.accountType
      },

      usage: {

        invoices: metric(usage.invoices_used, plan.invoice_limit),

        customers: metric(usage.customers_used, plan.customer_limit),

        suppliers: metric(usage.suppliers_used, plan.supplier_limit),

        ocr: metric(usage.ocr_pages_used, plan.ocr_limit),

        storage: {
          used: Number(usage.storage_used || 0),
          limit: plan.storage_limit,
          remaining: remainingOf(
            Number(usage.storage_used || 0),
            storageLimitToBytes(plan.storage_limit)
          )
        },

        team: metric(usage.team_members_used, plan.user_limit)

      }

    };

    // A Freelancer's "Companies: X/Y" is an account-level concept (not
    // tied to whichever company is currently selected) — surfaced
    // alongside the per-company breakdown above so the dashboard can show
    // both without a second round trip.
    if (plan.accountType === "FREELANCER") {

      const company = await companyRepository.findById(companyId);
      const freelancerLimits = await this.getFreelancerLimits(company.owner_user_id);
      const accountUsage = await usageRepository.getByUserIdAccountLevel(company.owner_user_id);

      result.companies = metric(
        accountUsage?.companies_used || 0,
        freelancerLimits.companies_limit
      );

    }

    return result;

  }

  // Atomically checks the invoice limit AND increments usage in one DB call,
  // replacing the old check-then-increment-later pair (see reserveOCRPages
  // for the full explanation of why that was racy and how this fixes it).
  // Throws the same error as before if the plan is full; callers that need
  // to undo a successful reservation (e.g. extraction failed afterward)
  // call decrementInvoices to release it.
  //
  // Deliberately uses getPlanLimits, NOT getUsage: getUsage also
  // reconciles usage_stats.invoices_used to match the live COUNT(*) of
  // persisted invoices, which assumes the counter only ever moves *after*
  // a row is actually saved. Reservations here happen *before* the invoice
  // is persisted, so a concurrent getUsage() call would see the reserved
  // count as "drift" and reset it back down mid-race — silently undoing
  // other requests' reservations and letting more through than the limit
  // allows. Skipping the reconciliation avoids that entirely; the atomic
  // UPDATE below is the only thing that needs to see the live row.
  async reserveInvoiceSlot(companyId) {

    await this.ensureUsageRecord(companyId);

    const plan = await this.getPlanLimits(companyId);

    const reserved = await usageRepository.incrementInvoicesIfUnderLimit(
      companyId,
      plan.invoice_limit
    );

    if (!reserved) {
      throw new Error(
        "Invoice limit reached. Please upgrade your subscription."
      );
    }

  }

  async checkCustomerLimit(companyId) {

    const data = await this.getUsage(companyId);

    if (
      data.usage.customers.limit !== null &&
      data.usage.customers.used >= data.usage.customers.limit
    ) {

      throw new Error(
        "Customer limit reached. Please upgrade your subscription."
      );

    }

    return true;

  }

  async checkStorageLimit(companyId, bytes) {

    const data = await this.getUsage(companyId);
    const limitBytes = storageLimitToBytes(data.usage.storage.limit);

    if (data.usage.storage.used + bytes > limitBytes) {
      throw new Error(
        "Storage limit reached. Please upgrade your subscription."
      );
    }

    return true;

  }

  // Atomically checks-and-increments in one DB call — checkCustomerLimit
  // above (a separate SELECT) followed by a separate incrementCustomers
  // UPDATE let concurrent customer-creation requests all read the same
  // pre-increment count and all pass the check before any of them had
  // incremented, so N concurrent requests near the limit could all
  // succeed and push customers_used arbitrarily past it. This is the same
  // race reserveInvoiceSlot/reserveOCRPages were already fixed for; the
  // client and storage paths just hadn't been given the same fix yet.
  // Callers that need to undo a successful reservation on a later failure
  // call decrementCustomers to release it.
  // See reserveInvoiceSlot for why this uses getPlanLimits rather than
  // getUsage — same reconciliation-vs-reservation conflict applies here.
  async reserveCustomerSlot(companyId) {

    await this.ensureUsageRecord(companyId);

    const plan = await this.getPlanLimits(companyId);

    const reserved = await usageRepository.incrementCustomersIfUnderLimit(
      companyId,
      plan.customer_limit
    );

    if (!reserved) {
      throw new Error(
        "Customer limit reached. Please upgrade your subscription."
      );
    }

  }

  // Same atomic check-and-increment pattern as reserveCustomerSlot — no
  // supplier quota existed before this feature.
  async reserveSupplierSlot(companyId) {

    await this.ensureUsageRecord(companyId);

    const plan = await this.getPlanLimits(companyId);

    const reserved = await usageRepository.incrementSuppliersIfUnderLimit(
      companyId,
      plan.supplier_limit
    );

    if (!reserved) {
      throw new Error(
        "Supplier limit reached. Please upgrade your subscription."
      );
    }

  }

  // Same atomic check-and-increment fix as reserveClientSlot, for storage.
  // checkStorageLimit+addStorage above were the same racy check-then-write
  // pair — concurrent uploads could all read the same pre-upload
  // storage_used, all pass the check, and all add their bytes, pushing
  // storage_used past the plan's limit.
  async reserveStorage(companyId, bytes) {

    await this.ensureUsageRecord(companyId);

    const plan = await this.getPlanLimits(companyId);
    const limitBytes = storageLimitToBytes(plan.storage_limit);

    const reserved = await usageRepository.addStorageIfUnderLimit(
      companyId,
      bytes,
      limitBytes
    );

    if (!reserved) {
      throw new Error(
        "Storage limit reached. Please upgrade your subscription."
      );
    }

  }

  // Atomically checks-and-increments OCR page usage in one DB call.
  //
  // The old flow was check(); ...slow Gemini call...; increment() — two
  // separate statements with a multi-second network call between them.
  // Every concurrent request read the same pre-upload usage snapshot and
  // passed the check before any of them had incremented, so N concurrent
  // uploads near the limit could all pass and push usage arbitrarily past
  // it (this is PERF-02). Folding the check and the increment into a
  // single `UPDATE ... WHERE ocr_pages_used + ? <= limit` closes that
  // window: MySQL takes a row lock for the duration of the UPDATE, so
  // concurrent reservations for the same company are forced to execute one
  // at a time, and each one evaluates the limit against the row's true,
  // just-updated value rather than a stale value read earlier. Whichever
  // requests still fit end up incremented; the rest see affectedRows = 0
  // and get the same error as before, atomically and without any
  // explicit transaction or SELECT ... FOR UPDATE needed.
  // See reserveInvoiceSlot for why this uses getPlanLimits rather than
  // getUsage — same reconciliation-vs-reservation conflict applies here.
  async reserveOCRPages(companyId, pages = 1) {

    await this.ensureUsageRecord(companyId);

    const plan = await this.getPlanLimits(companyId);

    const reserved = await usageRepository.incrementOCRIfUnderLimit(
      companyId,
      pages,
      plan.ocr_limit
    );

    if (!reserved) {
      throw new Error(
        "OCR page limit reached. Please upgrade your subscription."
      );
    }

  }

  async ensureUsageRecord(companyId) {

    const usage = await usageRepository.getByCompanyId(companyId);

    if (!usage) {
      await usageRepository.create(companyId);
    }

  }

  async ensureAccountLevelUsageRecord(userId) {

    const usage = await usageRepository.getByUserIdAccountLevel(userId);

    if (!usage) {
      await usageRepository.createAccountLevel(userId);
    }

  }

  // Gates company creation for a Freelancer — atomically checks-and-
  // increments companies_used on their own account-level usage_stats row
  // (company_id IS NULL) in one DB call, same pattern as every other
  // reserve* method here. Called BEFORE the company row itself is created
  // (see companyService.createCompany); on any failure afterward,
  // decrementCompanySlot releases the reservation.
  async reserveCompanySlot(userId) {

    await this.ensureAccountLevelUsageRecord(userId);

    const limits = await this.getFreelancerLimits(userId);

    const reserved = await usageRepository.incrementCompaniesIfUnderLimit(
      userId,
      limits.companies_limit
    );

    if (!reserved) {
      throw new Error(
        "Company limit reached. Please upgrade your subscription."
      );
    }

  }

  async decrementCompanySlot(userId) {

    await usageRepository.decrementCompanies(userId);

  }

  async getAllCustomersUsage() {

    const rows = await usageRepository.getAllCustomersUsage();

    return rows.map(row => ({

      id: row.id,

      name: row.name,

      email: row.email,

      company_name: row.company_name,

      plan: row.plan_name,

      invoices: {
        used: Number(row.invoices_used || 0),
        limit: Number(row.invoice_limit || 0),
        remaining: Math.max(
          0,
          Number(row.invoice_limit || 0) -
          Number(row.invoices_used || 0)
        )
      },

      // No plan limit backs this yet — reported as a plain count.
      bankStatements: {
        used: Number(row.bank_statements_used || 0)
      },

      customers: {
        used: Number(row.customers_used || 0),
        limit: Number(row.customer_limit || 0),
        remaining: Math.max(
          0,
          Number(row.customer_limit || 0) -
          Number(row.customers_used || 0)
        )
      },

      ocr: {
        used: Number(row.ocr_pages_used || 0),
        limit: Number(row.ocr_limit || 0),
        remaining: Math.max(
          0,
          Number(row.ocr_limit || 0) -
          Number(row.ocr_pages_used || 0)
        )
      },

      storage: {
        used: Number(row.storage_used || 0),
        limit: Number(row.storage_limit || 0),
        remaining: Math.max(
          0,
          storageLimitToBytes(row.storage_limit || 0) -
            Number(row.storage_used || 0)
        )
      },

      team: {
        used: Number(row.team_members_used || 0),
        limit: Number(row.user_limit || 0),
        remaining: Math.max(
          0,
          Number(row.user_limit || 0) -
          Number(row.team_members_used || 0)
        )
      }

    }));

  }

  async decrementInvoices(companyId) {

    await usageRepository.decrementInvoices(companyId);

  }

  // Bank statements consume OCR pages (reserveOCRPages/decrementOCR,
  // unchanged above) but never invoices_used/invoice_limit — this is a
  // separate, uncapped counter for admin/dashboard reporting only.
  async incrementBankStatements(companyId) {

    await this.ensureUsageRecord(companyId);
    await usageRepository.incrementBankStatements(companyId);

  }

  async decrementBankStatements(companyId) {

    await usageRepository.decrementBankStatements(companyId);

  }

  async incrementCustomers(companyId) {

    await this.ensureUsageRecord(companyId);
    await usageRepository.incrementCustomers(companyId);

  }

  async decrementCustomers(companyId) {

    await usageRepository.decrementCustomers(companyId);

  }

  async decrementSuppliers(companyId) {

    await usageRepository.decrementSuppliers(companyId);

  }

  async decrementOCR(companyId, pages = 1) {

    await usageRepository.decrementOCR(companyId, pages);

  }

  async addStorage(companyId, bytes) {

    await this.ensureUsageRecord(companyId);
    await usageRepository.addStorage(companyId, bytes);

  }

  async removeStorage(companyId, bytes) {

    await usageRepository.removeStorage(companyId, bytes);

  }
  async canCreateInvoice(companyId) {

    const data = await this.getUsage(companyId);

    if (
      data.usage.invoices.limit !== null &&
      data.usage.invoices.used >= data.usage.invoices.limit
    ) {
      throw new Error(
        "Invoice limit reached. Please upgrade your subscription."
      );
    }

    return true;
  }
  async canCreateCustomer(companyId) {

    const data = await this.getUsage(companyId);

    if (
      data.usage.customers.limit !== null &&
      data.usage.customers.used >= data.usage.customers.limit
    ) {
      throw new Error(
        "Customer limit reached. Please upgrade your subscription."
      );
    }

    return true;
  }
  async canUseOCR(companyId, pages = 1) {

    const data = await this.getUsage(companyId);

    if (
      data.usage.ocr.used + pages >
      data.usage.ocr.limit
    ) {
      throw new Error(
        "OCR limit reached. Please upgrade your subscription."
      );
    }

    return true;
  }
  async canUploadStorage(companyId, bytes) {

    const data = await this.getUsage(companyId);
    const limitBytes = storageLimitToBytes(data.usage.storage.limit);

    if (data.usage.storage.used + bytes > limitBytes) {
      throw new Error(
        "Storage limit exceeded."
      );
    }

    return true;
  }

  async getAdminDashboard() {

    const summary =
        await usageRepository.getDashboardSummary();

    const customers =
        await usageRepository.getAllCustomersUsage();

    return {
        summary,
        customers
    };

}
}

module.exports = new UsageService();
