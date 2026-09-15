const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const invoiceGeneratorController = require("../controllers/invoiceGeneratorController");

// Public, unauthenticated, and does real CPU work (PDF rendering) per
// request with no signup gate — cap abuse the same way contactRoutes.js
// does for its own public endpoint.
const invoiceGeneratorRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test",
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: "Too many invoices generated. Please try again later.",
        });
    },
});

router.post("/pdf",
    invoiceGeneratorRateLimiter,
    (req, res) => invoiceGeneratorController.generatePdf(req, res)
);

module.exports = router;
