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

            const result = await authService.login(email, password);

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

}

module.exports = new AuthController();