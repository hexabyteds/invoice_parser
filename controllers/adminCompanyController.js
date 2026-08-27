const adminCompanyService = require("../services/adminCompanyService");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

class AdminCompanyController {
  async getSummary(req, res) {
    try {
      const summary = await adminCompanyService.getSummary();
      res.json({ success: true, summary });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async getCompanies(req, res) {
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

      const { companies, total } = await adminCompanyService.getCompanies({
        limit,
        offset,
        search: req.query.search || "",
        plan: req.query.plan || "all",
        status: req.query.status || "all",
        source: req.query.source || "all",
        usage: req.query.usage || "all",
        dateFrom: req.query.dateFrom || null,
        dateTo: req.query.dateTo || null,
      });

      res.json({
        success: true,
        companies,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + companies.length < total,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async getCompanyById(req, res) {
    try {
      const data = await adminCompanyService.getCompanyDetails(req.params.id);
      res.json({ success: true, ...data });
    } catch (err) {
      const status = err.message === "Company not found." ? 404 : 500;
      res.status(status).json({ success: false, error: err.message });
    }
  }

  async getActivity(req, res) {
    try {
      const activity = await adminCompanyService.getActivity(req.params.id);
      res.json({ success: true, activity });
    } catch (err) {
      const status = err.message === "Company not found." ? 404 : 500;
      res.status(status).json({ success: false, error: err.message });
    }
  }

  async updateStatus(req, res) {
    try {
      const status = await adminCompanyService.updateStatus(
        req.params.id,
        req.body.status,
        req.user.id
      );
      res.json({ success: true, status, message: `Company status updated to ${status}.` });
    } catch (err) {
      const status = err.message === "Company not found." ? 404 : 400;
      res.status(status).json({ success: false, error: err.message });
    }
  }
}

module.exports = new AdminCompanyController();
