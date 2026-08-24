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

// The check itself, usable outside of Express middleware — needed by
// routes like /api/upload that serve more than one module (invoices vs.
// bank statements) from a single endpoint, where which module applies
// isn't known until after the request body is parsed, so it can't be
// decided by a static route-level middleware.
function hasPermission(membership, module, action) {
  if (!membership) return false;
  if (OWNER_BYPASS.has(membership.role)) return true;

  const allowedActions = membership.permissions && membership.permissions[module];
  return Array.isArray(allowedActions) && allowedActions.includes(action);
}

function requireCompanyPermission(module, action) {
  return (req, res, next) => {
    if (!req.membership) {
      return res.status(500).json({
        success: false,
        error:
          "Company context missing — requireCompanyPermission must run after companyContext middleware.",
      });
    }

    if (!hasPermission(req.membership, module, action)) {
      return res.status(403).json({
        success: false,
        error: `You don't have ${action} access to ${module} in this company.`,
      });
    }

    next();
  };
}

module.exports = requireCompanyPermission;
module.exports.hasPermission = hasPermission;
