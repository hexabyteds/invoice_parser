const express = require("express");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

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
    // Every test request comes from the same loopback address, so without
    // this a suite doing more than 10 logins starts getting 429s partway
    // through and fails for reasons unrelated to what it's testing. Same
    // skip the other limiters here already carry; no test asserts on
    // login rate limiting (the only 429 assertions cover the upload
    // limiter in app-backend.js, which is untouched).
    skip: () => process.env.NODE_ENV === "test",
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: "Too many login attempts. Please try again later.",
        });
    },
});

// Closes the gap the IP-keyed limiter above leaves open: a tool that
// rotates its source IP (confirmed live in the Sept 2026 audit-log
// investigation — bursts of 3 failed logins against the same bot-created
// account, ~5s apart, a different IP every burst) never accumulates
// enough hits on one IP to trip it. This one is keyed on the target
// account instead, so it locks based on who's being attacked, not where
// from. Only failed attempts count (skipSuccessfulRequests) — a real
// user who mistypes their password a couple of times before succeeding
// shouldn't get locked out by their own successful login.
const loginEmailRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: () => process.env.NODE_ENV === "test",
    keyGenerator: (req, res) => {
        const email = String(req.body?.email || "").trim().toLowerCase();
        return email || ipKeyGenerator(req, res);
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: "Too many failed login attempts for this account. Please try again later.",
        });
    },
});

// Registration had no rate limiting at all — the same Sept 2026
// investigation found a scripted tool creating dozens of accounts this
// way. Keyed on IP, same rationale as forgot-password: no authenticated
// user exists yet at this point to key on instead.
const registerRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test",
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: "Too many registration attempts from this network. Please try again later.",
        });
    },
});

router.post("/register",
    registerRateLimiter,
    (req, res) => authController.register(req, res)
);

router.post("/login",
    loginRateLimiter,
    loginEmailRateLimiter,
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