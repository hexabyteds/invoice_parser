const adminAuditLogService = require("../services/adminAuditLogService");

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

class AdminAuditLogController {
  async getLogs(req, res) {
    try {
      const limit =
        req.query.limit === undefined ? DEFAULT_LIMIT : Number(req.query.limit);
      const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);

      if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        return res.status(400).json({
          success: false,
          error: `limit must be an integer between 1 and ${MAX_LIMIT}`,
        });
      }

      if (!Number.isSafeInteger(offset) || offset < 0) {
        return res.status(400).json({
          success: false,
          error: "offset must be a non-negative integer",
        });
      }

      const { logs, total } = await adminAuditLogService.getLogs({
        limit,
        offset,
        search: req.query.search || "",
        module: req.query.module || "all",
        action: req.query.action || "all",
        status: req.query.status || "all",
        accountType: req.query.accountType || "all",
        companyId: req.query.companyId ? Number(req.query.companyId) : null,
        userId: req.query.userId ? Number(req.query.userId) : null,
        dateFrom: req.query.dateFrom || null,
        dateTo: req.query.dateTo || null,
      });

      res.json({
        success: true,
        logs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + logs.length < total,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async getFilterOptions(req, res) {
    try {
      const options = await adminAuditLogService.getFilterOptions();
      res.json({ success: true, ...options });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new AdminAuditLogController();
