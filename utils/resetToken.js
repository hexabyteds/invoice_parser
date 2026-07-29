const crypto = require("crypto");

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// The raw token is what's emailed to the user and embedded in the reset
// link — it's never stored. Only its SHA-256 hash is stored, same
// principle as password hashing: a DB leak alone shouldn't hand out
// usable reset links.
function generateResetToken() {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    return { token, tokenHash, expiresAt };
}

function hashResetToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
    generateResetToken,
    hashResetToken,
    RESET_TOKEN_TTL_MS,
};
