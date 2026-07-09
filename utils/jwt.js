const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;

function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email
        },
        SECRET,
        {
            expiresIn: "7d"
        }
    );
}

function verifyToken(token) {
    return jwt.verify(token, SECRET);
}

module.exports = {
    generateToken,
    verifyToken
};