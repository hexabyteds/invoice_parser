const { verifyToken } = require("../utils/jwt");

module.exports = (req, res, next) => {

    const authHeader = req.headers.authorization;

    if (!authHeader) {

        return res.status(401).json({
            success: false,
            error: "Authorization header missing."
        });

    }

    const token = authHeader.replace("Bearer ", "");

    try {

        req.user = verifyToken(token);

        next();

    } catch (err) {

        return res.status(401).json({
            success: false,
            error: "Invalid token."
        });

    }

};