const adminAnalyticsService = require("../services/adminAnalyticsService");

const VALID_RANGES = ["today", "7d", "30d", "3m", "6m", "12m"];

class AdminAnalyticsController {
  async getSummary(req, res) {
    try {
      const summary = await adminAnalyticsService.getSummary();
      res.json({ success: true, summary });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async getGrowth(req, res) {
    try {
      const metric = ["users", "companies", "freelancers"].includes(req.query.metric)
        ? req.query.metric
        : "users";
      const range = VALID_RANGES.includes(req.query.range) ? req.query.range : "30d";

      const series = await adminAnalyticsService.getGrowth(metric, range);

      res.json({ success: true, metric, range, series });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async getDetails(req, res) {
    try {
      const range = VALID_RANGES.includes(req.query.range) ? req.query.range : "30d";
      const details = await adminAnalyticsService.getDetails(range);
      res.json({ success: true, range, ...details });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new AdminAnalyticsController();
