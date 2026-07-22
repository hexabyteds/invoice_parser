const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");

const planController = require("../controllers/planController");

router.use(authMiddleware, requireAdmin);

router.get("/", planController.getPlans);

router.get("/:id", planController.getPlan);

router.post("/", planController.createPlan);

router.put("/:id", planController.updatePlan);

router.patch("/:id/status", planController.changeStatus);

router.delete("/:id", planController.deletePlan);

module.exports = router;