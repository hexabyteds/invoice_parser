const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyContext = require("../middleware/companyContext");
const dashboardController = require("../controllers/dashboardController");

router.use(authMiddleware);
router.use(companyContext);

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

router.get("/document-types", (req, res) =>
    dashboardController.getDocumentTypeCounts(req, res)
);

module.exports = router;
