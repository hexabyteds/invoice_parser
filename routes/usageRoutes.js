const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyContext = require("../middleware/companyContext");
const requireAdmin = require("../middleware/requireAdmin");

const usageController = require("../controllers/usageController");


// Customer
router.get(
    "/",
    authMiddleware,
    companyContext,
    usageController.getMyUsage
);


// Admin
router.get(
    "/admin",
    authMiddleware,
    requireAdmin,
    usageController.getAllUsage
);


router.get(
    "/admin/dashboard",
    authMiddleware,
    requireAdmin,
    usageController.getAdminDashboard
);
module.exports = router;