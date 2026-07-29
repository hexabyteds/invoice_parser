// Slug vocabulary only — actual prices live on the plans table
// (plans.monthly_price/yearly_price) and are copied onto subscriptions.price
// at subscribe/change-plan time. See adminRepository.getPlatformStats for
// where monthly revenue is computed from that real data (SUB-06).
const VALID_PLANS = ["free", "starter", "growth", "business", "enterprise"];
const VALID_STATUSES = ["active", "suspended"];

function normalizePlan(plan) {
  return String(plan || "starter").toLowerCase();
}

module.exports = {
  VALID_PLANS,
  VALID_STATUSES,
  normalizePlan,
};
