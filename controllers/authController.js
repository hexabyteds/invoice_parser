const authService = require("../services/authService");

class AuthController {

    async register(req, res) {

        try {
            console.log("Request body:", req.body);
            const result = await authService.register(req.body);

            res.status(201).json({
                success: true,
                message: "User registered successfully.",
                user: result.user,
                subscription: result.subscription,
                token: result.token
            });

        } catch (err) {

            console.log("Error:", err);
            res.status(400).json({
                success: false,
                error: err.message
            });

        }

    }

    async login(req, res) {

        try {

            const { email, password } = req.body;

            // Validated here, before authService.login() ever touches the
            // DB/bcrypt — a missing field used to fall through to a raw
            // mysql2 "Bind parameters must not contain undefined" error or
            // a raw bcrypt "data and hash arguments required" error,
            // surfaced as a misleading 401 instead of a clean 400.
            if (!email || typeof email !== "string") {
                return res.status(400).json({
                    success: false,
                    error: "Email is required."
                });
            }

            if (!password || typeof password !== "string") {
                return res.status(400).json({
                    success: false,
                    error: "Password is required."
                });
            }

            const result = await authService.login(email, password, {
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
            });

            res.json({
                success: true,
                message: "Login successful.",
                user: result.user,
                token: result.token
            });

        } catch (err) {

            res.status(401).json({
                success: false,
                error: err.message
            });

        }

    }

    async me(req, res) {

        try {

            const user = await authService.me(req.user.id);

            res.json({
                success: true,
                user
            });

        } catch (err) {

            res.status(404).json({
                success: false,
                error: err.message
            });

        }

    }

    async updateProfile(req, res) {

        try {

            const user = await authService.updateProfile(req.user.id, req.body);

            res.json({
                success: true,
                user
            });

        } catch (err) {

            res.status(400).json({
                success: false,
                error: err.message
            });

        }

    }

    async loginHistory(req, res) {

        try {

            const history = await authService.getLoginHistory(req.user.id);

            res.json({
                success: true,
                history
            });

        } catch (err) {

            res.status(400).json({
                success: false,
                error: err.message
            });

        }

    }

    async forgotPassword(req, res) {

        try {

            if (!req.body.email || typeof req.body.email !== "string") {
                return res.status(400).json({
                    success: false,
                    error: "Email is required."
                });
            }

            await authService.forgotPassword(req.body.email);

            // Same response whether or not the email is registered.
            res.json({
                success: true,
                message:
                    "If an account exists for that email, we've sent a password reset link."
            });

        } catch (err) {

            res.status(400).json({
                success: false,
                error: err.message
            });

        }

    }

    async resetPassword(req, res) {

        try {

            await authService.resetPassword(
                req.body.token,
                req.body.password
            );

            res.json({
                success: true,
                message: "Password reset successfully. You can now log in."
            });

        } catch (err) {

            res.status(400).json({
                success: false,
                error: err.message
            });

        }

    }

}

module.exports = new AuthController();