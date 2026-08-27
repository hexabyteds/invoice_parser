const adminPaymentService = require("../services/adminPaymentService");

class AdminPaymentController {
  async getSummary(req, res) {
    try {
      const summary = await adminPaymentService.getSummary();
      res.json({ success: true, summary });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async getPayments(req, res) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 20;

      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          error: "limit must be an integer between 1 and 100",
        });
      }

      const data = await adminPaymentService.getPayments({
        limit,
        startingAfter: req.query.startingAfter || undefined,
        status: req.query.status || undefined,
      });

      res.json({ success: true, ...data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async getPaymentDetail(req, res) {
    try {
      const payment = await adminPaymentService.getPaymentDetail(req.params.id);
      res.json({ success: true, payment });
    } catch (err) {
      const status = err.message === "Payment not found." ? 404 : 500;
      res.status(status).json({ success: false, error: err.message });
    }
  }
}

module.exports = new AdminPaymentController();
