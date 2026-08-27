const adminAnalyticsRepository = require("../repositories/adminAnalyticsRepository");
const adminCompanyRepository = require("../repositories/adminCompanyRepository");

class AdminAnalyticsService {
  async getSummary() {
    return await adminAnalyticsRepository.getSummary();
  }

  async getGrowth(metric, range) {
    return await adminAnalyticsRepository.getGrowth(metric, range);
  }

  // Bundles every "today snapshot" section the Analytics page renders in
  // one round trip (plans, subscriptions, documents, usage, freelancers)
  // — each is a cheap aggregate query, and the page shows all of them at
  // once anyway, so this avoids five separate client requests.
  async getDetails(range) {
    const [planRows, planChanges, documentGrowth, nearLimitCompanies, freelancers] =
      await Promise.all([
        adminAnalyticsRepository.getPlanDistribution(),
        adminAnalyticsRepository.getPlanChanges(range),
        adminAnalyticsRepository.getDocumentGrowth(range),
        adminCompanyRepository.getNearLimitCompanies(10),
        adminAnalyticsRepository.getFreelancerAnalytics(),
      ]);

    const documentTotals = documentGrowth.reduce(
      (acc, day) => ({
        invoices: acc.invoices + day.invoices,
        bills: acc.bills + day.bills,
        failed: acc.failed + day.failed,
      }),
      { invoices: 0, bills: 0, failed: 0 }
    );

    return {
      plans: {
        company: planRows.filter((r) => r.account_type === "COMPANY"),
        freelancer: planRows.filter((r) => r.account_type === "FREELANCER"),
      },
      subscriptions: {
        upgrades: planChanges.upgrades,
        downgrades: planChanges.downgrades,
      },
      documents: {
        series: documentGrowth,
        totals: documentTotals,
      },
      usage: {
        nearLimitCompanies: nearLimitCompanies.map((c) => ({
          id: c.id,
          name: c.name,
          usageRatio: Number(c.usage_ratio),
          customers: { used: Number(c.customers_count), limit: c.customers_limit },
          suppliers: { used: Number(c.suppliers_count), limit: c.suppliers_limit },
          invoices: { used: Number(c.invoices_count), limit: c.invoices_limit },
        })),
      },
      freelancers,
    };
  }
}

module.exports = new AdminAnalyticsService();
