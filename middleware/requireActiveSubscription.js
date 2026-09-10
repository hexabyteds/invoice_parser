/**
 * Blocks transactional (create/edit/delete/upload) operations once a
 * company's (or Freelancer account's) trial has expired or its
 * subscription is otherwise inactive. Read operations are never gated by
 * this — it must only ever sit in front of a write route, alongside
 * requireCompanyPermission, never in front of a "view" one.
 *
 * Three usable forms, mirroring requireCompanyPermission.js's shape:
 *   - default export: Express middleware, needs req.company.id (set by
 *     companyContext) — router.post("/", requireActiveSubscription,
 *     requireCompanyPermission("customers", "create"), handler)
 *   - .forUser: Express middleware for the one company-scoped-nothing-yet
 *     route (a Freelancer creating their first/next company) — needs
 *     req.user.id instead.
 *   - .check(companyId): the plain async form, for /api/upload, which
 *     can't use static route-level middleware (which module applies
 *     isn't known until the body is parsed — see its existing manual
 *     requireCompanyPermission.hasPermission call).
 */

const subscriptionService = require("../services/subscriptionService");
const { canWrite, blockedReasonCode } = require("../utils/subscriptionAccess");

function blockedResponse(res, subscription) {
  const code = blockedReasonCode(subscription);

  return res.status(403).json({
    success: false,
    error:
      code === "TRIAL_EXPIRED"
        ? "Your free trial has ended. Upgrade your plan to continue."
        : "Your subscription is not active. Upgrade your plan to continue.",
    code,
  });
}

// The programmatic form — returns { allowed, subscription } rather than
// writing a response itself, so callers with more context (like
// /api/upload, which already builds its own 403 body) can decide how to
// respond.
async function check(companyId) {
  const { subscription } = await subscriptionService.resolveSubscriptionForCompany(companyId);
  return { allowed: canWrite(subscription), subscription };
}

async function requireActiveSubscription(req, res, next) {
  try {
    const { allowed, subscription } = await check(req.company.id);

    if (!allowed) {
      return blockedResponse(res, subscription);
    }

    next();
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

async function forUser(req, res, next) {
  // Only a FREELANCER has an account-level (company_id NULL) subscription
  // row at all. A COMPANY account calling this route is already invalid
  // for reasons unrelated to trials — let the existing service-layer
  // check (companyService.createCompany) produce its own clear rejection
  // instead of masking it behind an unrelated "no subscription" error.
  if (req.user.account_type !== "FREELANCER") {
    return next();
  }

  try {
    // A brand-new Freelancer has no account-level row yet — registration
    // only eagerly creates one for a COMPANY account (see authService.
    // register). Same lazy-create fallback resolveSubscriptionForCompany/
    // getFreelancerLimits already use, so a first-ever "create a company"
    // call isn't itself rejected as "no subscription found".
    let subscription;

    try {
      subscription = await subscriptionService.getCurrentSubscriptionForUser(req.user.id);
    } catch (error) {
      if (error.message === "No active subscription found.") {
        subscription = await subscriptionService.createFreeSubscriptionForUser(req.user.id);
      } else {
        throw error;
      }
    }

    if (!canWrite(subscription)) {
      return blockedResponse(res, subscription);
    }

    next();
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

module.exports = requireActiveSubscription;
module.exports.forUser = forUser;
module.exports.check = check;
