const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const invitationController = require("../controllers/invitationController");

// This router deliberately does NOT blanket-apply authMiddleware the way
// routes/companyRoutes.js does — the token preview must be reachable by a
// visitor who isn't logged in yet (Case A of the invitation flow: they may
// not even have an account). Only the accept endpoint requires auth,
// applied per-route.

// Public, unauthenticated, and enumeration-adjacent (a bare token guess
// would otherwise get free signal on whether it's valid) — same rate-limit
// shape as routes/authRoutes.js's forgotPasswordRateLimiter. The token
// itself is a 32-byte random value, so this caps abuse, not guards
// against guessing.
const invitationTokenRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: "Too many requests. Please try again later.",
        });
    },
});

router.get("/token/:token",
    invitationTokenRateLimiter,
    (req, res) => invitationController.validateToken(req, res)
);

router.post("/token/:token/accept",
    authMiddleware,
    (req, res) => invitationController.acceptByToken(req, res)
);

module.exports = router;
