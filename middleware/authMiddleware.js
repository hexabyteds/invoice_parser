const { verifyToken } = require("../utils/jwt");
const db = require("../config/database");

module.exports = async (req, res, next) => {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            error: "Authorization header missing."
        });
    }

    if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            error: "Invalid authorization format."
        });
    }

    const token = authHeader.replace("Bearer ", "");

    try {

        // 1. Verify JWT
        const decoded = verifyToken(token);

        // 2. Get current user from database
        const [rows] = await db.execute(
            `
            SELECT
                id,
                name,
                email,
                role,
                status,
                is_active,
                deleted_at
            FROM users
            WHERE id = ?
            LIMIT 1
            `,
            [decoded.id]
        );

        // User doesn't exist
        if (!rows.length) {
            return res.status(401).json({
                success: false,
                error: "Account not found."
            });
        }

        const user = rows[0];

        // 3. Account deleted
        if (user.deleted_at !== null) {
            return res.status(401).json({
                success: false,
                error: "Account has been deleted."
            });
        }

        // 4. Account suspended
        if (user.status !== "ACTIVE") {
            return res.status(401).json({
                success: false,
                error: "Account is suspended."
            });
        }

        // 5. Account inactive
        if (user.is_active !== 1) {
            return res.status(401).json({
                success: false,
                error: "Account is inactive."
            });
        }

        // 6. Use current DB information
        req.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        next();

    } catch (err) {

        console.error("Auth middleware error:", err);

        return res.status(401).json({
            success: false,
            error: "Invalid token."
        });

    }

};