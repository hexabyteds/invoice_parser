const usageRepository = require("../repositories/usageRepository");
const subscriptionService = require("./subscriptionService");

class UsageService {

  async getUsage(userId) {

    let usage = await usageRepository.getByUserId(userId);

    // Create usage record automatically if missing
    if (!usage) {
      await usageRepository.create(userId);
      usage = await usageRepository.getByUserId(userId);
    }

    const subscription =
      await subscriptionService.getActiveSubscription(userId);

    if (!subscription) {
      throw new Error("No active subscription found.");
    }

    const plan = subscription.plan;

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

        clients: {
          used: usage.clients_used,
          limit: plan.client_limit,
          remaining: Math.max(
            0,
            plan.client_limit - usage.clients_used
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
          used: usage.storage_used,
          limit: plan.storage_limit,
          remaining: Math.max(
            0,
            plan.storage_limit - usage.storage_used
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

  async checkInvoiceLimit(userId) {

    const data = await this.getUsage(userId);

    if (
      data.usage.invoices.used >=
      data.usage.invoices.limit
    ) {

      throw new Error(
        "Invoice limit reached. Please upgrade your subscription."
      );

    }

    return true;

  }

  async checkClientLimit(userId) {

    const data = await this.getUsage(userId);

    if (
      data.usage.clients.used >=
      data.usage.clients.limit
    ) {

      throw new Error(
        "Client limit reached. Please upgrade your subscription."
      );

    }

    return true;

  }

  async checkStorageLimit(userId, bytes) {

    const data = await this.getUsage(userId);

    if (data.usage.storage.used + bytes > data.usage.storage.limit) {
      throw new Error(
        "Storage limit reached. Please upgrade your subscription."
      );
    }

    return true;

  }

  async checkOCRLimit(userId, pages = 1) {

    const data = await this.getUsage(userId);

    if (data.usage.ocr.used + pages > data.usage.ocr.limit) {
      throw new Error(
        "OCR page limit reached. Please upgrade your subscription."
      );
    }

    return true;

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

        clients: {
            used: Number(row.clients_used || 0),
            limit: Number(row.client_limit || 0),
            remaining: Math.max(
                0,
                Number(row.client_limit || 0) -
                Number(row.clients_used || 0)
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
                Number(row.storage_limit || 0) -
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

  async incrementInvoices(userId) {

    await this.ensureUsageRecord(userId);
    await usageRepository.incrementInvoices(userId);

  }

  async decrementInvoices(userId) {

    await usageRepository.decrementInvoices(userId);

  }

  async incrementClients(userId) {

    await this.ensureUsageRecord(userId);
    await usageRepository.incrementClients(userId);

  }

  async decrementClients(userId) {

    await usageRepository.decrementClients(userId);

  }

  async incrementOCR(userId, pages = 1) {

    await this.ensureUsageRecord(userId);
    await usageRepository.incrementOCR(userId, pages);

  }

  async addStorage(userId, bytes) {

    await this.ensureUsageRecord(userId);
    await usageRepository.addStorage(userId, bytes);

  }

  async removeStorage(userId, bytes) {

    await usageRepository.removeStorage(userId, bytes);

  }
}

module.exports = new UsageService();