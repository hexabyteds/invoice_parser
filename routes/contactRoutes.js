const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const contactController = require("../controllers/contactController");

// Public, unauthenticated, and sends an email per request — cap abuse the
// same way forgot-password does in authRoutes.js.
const contactRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    // The test suite fires more than 5 requests at this route from the same
    // IP to cover its validation branches — skip limiting there, same as
    // any other environment-gated test concern in this app.
    skip: () => process.env.NODE_ENV === "test",
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: "Too many messages sent. Please try again later.",
        });
    },
});

router.post("/",
    contactRateLimiter,
    (req, res) => contactController.submit(req, res)
);

module.exports = router;
