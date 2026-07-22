const express = require("express");

const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");
const adminController = require("../controllers/adminController");

router.use(authMiddleware, requireAdmin);

router.get("/stats", (req, res) => adminController.getStats(req, res));
router.get("/customers", (req, res) => adminController.getCustomers(req, res));
router.get("/customers/:id", (req, res) =>
  adminController.getCustomerById(req, res)
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
