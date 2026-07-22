const PLAN_PRICES = {
  starter: 19,
  growth: 49,
  business: 99,
  enterprise: 199,
  free: 0,
};

const VALID_PLANS = Object.keys(PLAN_PRICES);
const VALID_STATUSES = ["active", "suspended"];

function normalizePlan(plan) {
  return String(plan || "starter").toLowerCase();
}

function getPlanPrice(plan) {
  return PLAN_PRICES[normalizePlan(plan)] || 0;
}

function calculateMonthlyRevenue(users) {
  return users.reduce((total, user) => {
    if (String(user.status || "").toLowerCase() !== "active") {
      return total;
    }

    return total + getPlanPrice(user.plan);
  }, 0);
}

module.exports = {
  PLAN_PRICES,
  VALID_PLANS,
  VALID_STATUSES,
  normalizePlan,
  getPlanPrice,
  calculateMonthlyRevenue,
};
