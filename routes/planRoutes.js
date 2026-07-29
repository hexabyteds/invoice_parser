const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");

const planController = require("../controllers/planController");

// ==========================================
// CUSTOMER / PUBLIC
// ==========================================

// Active plans only
router.get(
    "/",
    planController.getActivePlans
);


// ==========================================
// ADMIN ONLY
// ==========================================

// All plans including inactive
router.get(
    "/admin",
    authMiddleware,
    requireAdmin,
    planController.getPlans
);

// Single plan
router.get(
    "/:id",
    authMiddleware,
    requireAdmin,
    planController.getPlan
);

router.post(
    "/",
    authMiddleware,
    requireAdmin,
    planController.createPlan
);

router.put(
    "/:id",
    authMiddleware,
    requireAdmin,
    planController.updatePlan
);

router.patch(
    "/:id/status",
    authMiddleware,
    requireAdmin,
    planController.changeStatus
);

router.delete(
    "/:id",
    authMiddleware,
    requireAdmin,
    planController.deletePlan
);

module.exports = router;