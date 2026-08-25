const usageRepository = require("../repositories/usageRepository");
const customerRepository = require("../repositories/customerRepository");
const invoiceRepository = require("../repositories/invoiceRepository");
const subscriptionService = require("./subscriptionService");

const BYTES_PER_MB = 1024 * 1024;

function storageLimitToBytes(limitMb) {
  return Number(limitMb || 0) * BYTES_PER_MB;
}

function planFromSubscription(subscription) {
  return {
    id: subscription.plan_id,
    name: subscription.name,
    slug: subscription.slug,
    invoice_limit: subscription.invoice_limit,
    customer_limit: subscription.customer_limit,
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
  async getPlanLimits(userId) {

    let subscription;

    try {
      subscription = await subscriptionService.getCurrentSubscription(userId);
    } catch (error) {
      if (error.message === "No active subscription found.") {
        subscription = await subscriptionService.createFreeSubscription(userId);
      } else {
        throw error;
      }
    }

    return planFromSubscription(subscription);

  }

  async getUsage(userId) {

    let usage = await usageRepository.getByUserId(userId);

    // Create usage record automatically if missing
    if (!usage) {
      await usageRepository.create(userId);
      usage = await usageRepository.getByUserId(userId);
    }

    const plan = await this.getPlanLimits(userId);

    const actualCustomers = await customerRepository.countByUser(userId);
    const actualInvoices = await invoiceRepository.countByUser(userId);

    if (usage.customers_used !== actualCustomers) {
      await usageRepository.updateCustomers(userId, actualCustomers);
      usage.customers_used = actualCustomers;
    }

    if (usage.invoices_used !== actualInvoices) {
      await usageRepository.updateInvoices(userId, actualInvoices);
      usage.invoices_used = actualInvoices;
    }

    return {

      plan: {
        id: plan.id,
        name: plan.name,
        slug: plan.slug
      },

      usage: {

        invoices: {
          used: usage.invoices_used,
          limit: plan.invoice_limit,
          remaining: Math.max(
            0,
            plan.invoice_limit - usage.invoices_used
          )
        },

        customers: {
          used: usage.customers_used,
          limit: plan.customer_limit,
          remaining: Math.max(
            0,
            plan.customer_limit - usage.customers_used
          )
        },

        ocr: {
          used: usage.ocr_pages_used,
          limit: plan.ocr_limit,
          remaining: Math.max(
            0,
            plan.ocr_limit - usage.ocr_pages_used
          )
        },

        storage: {
          used: Number(usage.storage_used || 0),
          limit: plan.storage_limit,
          remaining: Math.max(
            0,
            storageLimitToBytes(plan.storage_limit) -
              Number(usage.storage_used || 0)
          )
        },

        team: {
          used: usage.team_members_used,
          limit: plan.user_limit,
          remaining: Math.max(
            0,
            plan.user_limit - usage.team_members_used
          )
        }

      }

    };

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
  async reserveInvoiceSlot(userId) {

    await this.ensureUsageRecord(userId);

    const plan = await this.getPlanLimits(userId);

    const reserved = await usageRepository.incrementInvoicesIfUnderLimit(
      userId,
      plan.invoice_limit
    );

    if (!reserved) {
      throw new Error(
        "Invoice limit reached. Please upgrade your subscription."
      );
    }

  }

  async checkCustomerLimit(userId) {

    const data = await this.getUsage(userId);

    if (
      data.usage.customers.used >=
      data.usage.customers.limit
    ) {

      throw new Error(
        "Customer limit reached. Please upgrade your subscription."
      );

    }

    return true;

  }

  async checkStorageLimit(userId, bytes) {

    const data = await this.getUsage(userId);
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
  async reserveCustomerSlot(userId) {

    await this.ensureUsageRecord(userId);

    const plan = await this.getPlanLimits(userId);

    const reserved = await usageRepository.incrementCustomersIfUnderLimit(
      userId,
      plan.customer_limit
    );

    if (!reserved) {
      throw new Error(
        "Customer limit reached. Please upgrade your subscription."
      );
    }

  }

  // Same atomic check-and-increment fix as reserveClientSlot, for storage.
  // checkStorageLimit+addStorage above were the same racy check-then-write
  // pair — concurrent uploads could all read the same pre-upload
  // storage_used, all pass the check, and all add their bytes, pushing
  // storage_used past the plan's limit.
  async reserveStorage(userId, bytes) {

    await this.ensureUsageRecord(userId);

    const plan = await this.getPlanLimits(userId);
    const limitBytes = storageLimitToBytes(plan.storage_limit);

    const reserved = await usageRepository.addStorageIfUnderLimit(
      userId,
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
  // concurrent reservations for the same user are forced to execute one
  // at a time, and each one evaluates the limit against the row's true,
  // just-updated value rather than a stale value read earlier. Whichever
  // requests still fit end up incremented; the rest see affectedRows = 0
  // and get the same error as before, atomically and without any
  // explicit transaction or SELECT ... FOR UPDATE needed.
  // See reserveInvoiceSlot for why this uses getPlanLimits rather than
  // getUsage — same reconciliation-vs-reservation conflict applies here.
  async reserveOCRPages(userId, pages = 1) {

    await this.ensureUsageRecord(userId);

    const plan = await this.getPlanLimits(userId);

    const reserved = await usageRepository.incrementOCRIfUnderLimit(
      userId,
      pages,
      plan.ocr_limit
    );

    if (!reserved) {
      throw new Error(
        "OCR page limit reached. Please upgrade your subscription."
      );
    }

  }

  async ensureUsageRecord(userId) {

    const usage = await usageRepository.getByUserId(userId);

    if (!usage) {
      await usageRepository.create(userId);
    }

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

  async decrementInvoices(userId) {

    await usageRepository.decrementInvoices(userId);

  }

  // Bank statements consume OCR pages (reserveOCRPages/decrementOCR,
  // unchanged above) but never invoices_used/invoice_limit — this is a
  // separate, uncapped counter for admin/dashboard reporting only.
  async incrementBankStatements(userId) {

    await this.ensureUsageRecord(userId);
    await usageRepository.incrementBankStatements(userId);

  }

  async decrementBankStatements(userId) {

    await usageRepository.decrementBankStatements(userId);

  }

  async incrementCustomers(userId) {

    await this.ensureUsageRecord(userId);
    await usageRepository.incrementCustomers(userId);

  }

  async decrementCustomers(userId) {

    await usageRepository.decrementCustomers(userId);

  }

  async decrementOCR(userId, pages = 1) {

    await usageRepository.decrementOCR(userId, pages);

  }

  async addStorage(userId, bytes) {

    await this.ensureUsageRecord(userId);
    await usageRepository.addStorage(userId, bytes);

  }

  async removeStorage(userId, bytes) {

    await usageRepository.removeStorage(userId, bytes);

  }
  async canCreateInvoice(userId) {

    const data = await this.getUsage(userId);

    if (data.usage.invoices.used >= data.usage.invoices.limit) {
      throw new Error(
        "Invoice limit reached. Please upgrade your subscription."
      );
    }

    return true;
  }
  async canCreateCustomer(userId) {

    const data = await this.getUsage(userId);

    if (data.usage.customers.used >= data.usage.customers.limit) {
      throw new Error(
        "Customer limit reached. Please upgrade your subscription."
      );
    }

    return true;
  }
  async canUseOCR(userId, pages = 1) {

    const data = await this.getUsage(userId);

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
  async canUploadStorage(userId, bytes) {

    const data = await this.getUsage(userId);
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