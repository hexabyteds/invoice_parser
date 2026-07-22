const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");

const usageController = require("../controllers/usageController");


// Customer
router.get(
    "/",
    authMiddleware,
    usageController.getMyUsage
);


// Admin
router.get(
    "/admin",
    authMiddleware,
    requireAdmin,
    usageController.getAllUsage
);

module.exports = router;