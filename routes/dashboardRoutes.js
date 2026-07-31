const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const dashboardController = require("../controllers/dashboardController");

router.use(authMiddleware);

router.get("/summary", (req, res) =>
    dashboardController.getSummary(req, res)
);

router.get("/monthly", (req, res) =>
    dashboardController.getMonthly(req, res)
);

router.get("/top-clients", (req, res) =>
    dashboardController.getTopClients(req, res)
);

router.get("/confidence-distribution", (req, res) =>
    dashboardController.getConfidenceDistribution(req, res)
);

router.get("/quality", (req, res) =>
    dashboardController.getQuality(req, res)
);

router.get("/client-analytics", (req, res) =>
    dashboardController.getClientAnalytics(req, res)
);

router.get("/activity", (req, res) =>
    dashboardController.getActivity(req, res)
);

module.exports = router;
