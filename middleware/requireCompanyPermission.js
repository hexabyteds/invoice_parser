/**
 * Per-module, per-action permission gate for a company-scoped route. Must
 * run after companyContext (needs req.membership).
 *
 * OWNER always passes — a company's owner is never locked out of their own
 * data. Every other role (FREELANCER, STAFF) is deny-by-default: access to
 * a module/action must be explicitly listed in the membership's
 * `permissions` JSON, e.g. { "invoices": ["view", "create"] }. Adding a new
 * module or action later is just a new key/value — no schema change, no
 * redesign.
 *
 * Usage: router.get("/", auth, companyContext, requireCompanyPermission("invoices", "view"), handler)
 */

const OWNER_BYPASS = new Set(["OWNER"]);

module.exports = function requireCompanyPermission(module, action) {
  return (req, res, next) => {
    const membership = req.membership;

    if (!membership) {
      return res.status(500).json({
        success: false,
        error:
          "Company context missing — requireCompanyPermission must run after companyContext middleware.",
      });
    }

    if (OWNER_BYPASS.has(membership.role)) {
      return next();
    }

    const allowedActions = membership.permissions && membership.permissions[module];

    if (!Array.isArray(allowedActions) || !allowedActions.includes(action)) {
      return res.status(403).json({
        success: false,
        error: `You don't have ${action} access to ${module} in this company.`,
      });
    }

    next();
  };
};
