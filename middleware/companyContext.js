/**
 * Resolves which company a request is operating on, and rejects with 403
 * before any controller runs if the authenticated user isn't an active
 * member of that company. Must run after authMiddleware (needs req.user).
 *
 * The caller may name a workspace via the `X-Company-Id` header or a
 * `companyId` query param — but naming one is never itself authorization;
 * it only selects which of the caller's own memberships to use. If no
 * workspace is named, this defaults to the company the user OWNS, so every
 * existing single-company account keeps working exactly as it does today
 * with no frontend change required (the workspace switcher lands in a
 * later milestone).
 */

const db = require("../config/database");

module.exports = async function companyContext(req, res, next) {
  const requestedCompanyId = req.headers["x-company-id"]
    ? Number(req.headers["x-company-id"])
    : req.query.companyId
    ? Number(req.query.companyId)
    : null;

  try {
    const [rows] = requestedCompanyId
      ? await db.execute(
          `SELECT m.id AS membership_id, m.company_id, m.role, m.status, m.permissions,
                  c.name AS company_name, c.status AS company_status
           FROM company_memberships m
           JOIN companies c ON c.id = m.company_id
           WHERE m.company_id = ? AND m.user_id = ?
           LIMIT 1`,
          [requestedCompanyId, req.user.id]
        )
      : await db.execute(
          `SELECT m.id AS membership_id, m.company_id, m.role, m.status, m.permissions,
                  c.name AS company_name, c.status AS company_status
           FROM company_memberships m
           JOIN companies c ON c.id = m.company_id
           WHERE m.user_id = ? AND m.role = 'OWNER'
           LIMIT 1`,
          [req.user.id]
        );

    if (!rows.length) {
      return res.status(403).json({
        success: false,
        error: "You do not have access to this company.",
      });
    }

    const membership = rows[0];

    if (membership.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        error: "Your access to this company is not active.",
      });
    }

    if (membership.company_status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        error: "This company is not active.",
      });
    }

    req.company = {
      id: membership.company_id,
      name: membership.company_name,
    };

    req.membership = {
      id: membership.membership_id,
      role: membership.role,
      // JSON column — mysql2 hands this back already parsed (object or null).
      permissions: membership.permissions,
    };

    next();
  } catch (err) {
    console.error("Company context middleware error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to resolve company context.",
    });
  }
};
