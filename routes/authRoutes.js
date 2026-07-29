const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// Sends an email per request and is user-enumeration-adjacent, so it's kept
// tight and keyed on IP (there's no authenticated user yet at this point).
const forgotPasswordRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: "Too many password reset requests. Please try again later.",
        });
    },
});

// The reset token itself is a 32-byte random value, so brute force isn't
// realistic — this just caps abuse, not guards against guessing.
const resetPasswordRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: "Too many attempts. Please try again later.",
        });
    },
});

router.post("/register", (req, res) =>
    authController.register(req, res)
);

router.post("/login", (req, res) =>
    authController.login(req, res)
);

router.get("/me",
    authMiddleware,
    (req, res) => authController.me(req, res)
);

router.post("/forgot-password",
    forgotPasswordRateLimiter,
    (req, res) => authController.forgotPassword(req, res)
);

router.post("/reset-password",
    resetPasswordRateLimiter,
    (req, res) => authController.resetPassword(req, res)
);

module.exports = router;