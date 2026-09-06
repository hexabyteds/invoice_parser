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

// Unlike the reset token, a login password IS guessable, so this guards
// against brute force — keyed on IP, same as forgot-password above.
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: "Too many login attempts. Please try again later.",
        });
    },
});

router.post("/register", (req, res) =>
    authController.register(req, res)
);

router.post("/login",
    loginRateLimiter,
    (req, res) => authController.login(req, res)
);

router.get("/me",
    authMiddleware,
    (req, res) => authController.me(req, res)
);

router.put("/profile",
    authMiddleware,
    (req, res) => authController.updateProfile(req, res)
);

// Deliberately not named "/login-*" — api.js's request interceptor treats
// any URL containing "/auth/login" as a public (unauthenticated) endpoint
// so a stale token doesn't get attached to the login form's own request;
// a "/auth/login-history" path would accidentally match that same check
// via string includes() and go out with no Authorization header.
router.get("/recent-logins",
    authMiddleware,
    (req, res) => authController.loginHistory(req, res)
);

router.post("/forgot-password",
    forgotPasswordRateLimiter,
    (req, res) => authController.forgotPassword(req, res)
);

router.post("/reset-password",
    resetPasswordRateLimiter,
    (req, res) => authController.resetPassword(req, res)
);

router.get("/verify-email/:token",
    (req, res) => authController.verifyEmail(req, res)
);

router.post("/resend-verification",
    authMiddleware,
    (req, res) => authController.resendVerification(req, res)
);

module.exports = router;