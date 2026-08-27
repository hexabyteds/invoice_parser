const express = require("express");

const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");
const adminController = require("../controllers/adminController");
const adminCompanyController = require("../controllers/adminCompanyController");
const adminAnalyticsController = require("../controllers/adminAnalyticsController");
const adminAuditLogController = require("../controllers/adminAuditLogController");
const adminPaymentController = require("../controllers/adminPaymentController");

router.use(authMiddleware, requireAdmin);

router.get("/stats", (req, res) => adminController.getStats(req, res));

// Company Management module
router.get("/companies/summary", (req, res) => adminCompanyController.getSummary(req, res));
router.get("/companies", (req, res) => adminCompanyController.getCompanies(req, res));
router.get("/companies/:id", (req, res) => adminCompanyController.getCompanyById(req, res));
router.get("/companies/:id/activity", (req, res) => adminCompanyController.getActivity(req, res));
router.patch("/companies/:id/status", (req, res) => adminCompanyController.updateStatus(req, res));

// Analytics module
router.get("/analytics/summary", (req, res) => adminAnalyticsController.getSummary(req, res));
router.get("/analytics/growth", (req, res) => adminAnalyticsController.getGrowth(req, res));
router.get("/analytics/details", (req, res) => adminAnalyticsController.getDetails(req, res));

// Audit Logs module
router.get("/audit-logs", (req, res) => adminAuditLogController.getLogs(req, res));
router.get("/audit-logs/filter-options", (req, res) => adminAuditLogController.getFilterOptions(req, res));

// Payments module
router.get("/payments/summary", (req, res) => adminPaymentController.getSummary(req, res));
router.get("/payments", (req, res) => adminPaymentController.getPayments(req, res));
router.get("/payments/:id", (req, res) => adminPaymentController.getPaymentDetail(req, res));
router.get("/customers", (req, res) => adminController.getCustomers(req, res));
router.get("/customers/:id", (req, res) =>
  adminController.getCustomerById(req, res)
);
router.get("/customers/:id/login-history", (req, res) =>
  adminController.getCustomerLoginHistory(req, res)
);
router.put("/customers/:id", (req, res) =>
  adminController.updateCustomer(req, res)
);
router.patch("/customers/:id/status", (req, res) =>
  adminController.updateCustomerStatus(req, res)
);
router.patch("/customers/:id/plan", (req, res) =>
  adminController.updateCustomerPlan(req, res)
);
router.post("/customers/:id/reset-password", (req, res) =>
  adminController.resetCustomerPassword(req, res)
);
router.get("/subscriptions", (req, res) =>
  adminController.getSubscriptions(req, res)
);
router.delete("/customers/:id", (req, res) =>
  adminController.deleteCustomer(req, res)
);

module.exports = router;
