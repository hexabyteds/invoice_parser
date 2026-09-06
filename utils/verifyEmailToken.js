const crypto = require("crypto");

const VERIFY_EMAIL_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

// Same principle as utils/resetToken.js: the raw token is what's emailed
// and embedded in the verification link — it's never stored. Only its
// SHA-256 hash is stored, so a DB leak alone can't hand out usable
// verification links.
function generateVerifyEmailToken() {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashVerifyEmailToken(token);
    const expiresAt = new Date(Date.now() + VERIFY_EMAIL_TOKEN_TTL_MS);

    return { token, tokenHash, expiresAt };
}

function hashVerifyEmailToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
    generateVerifyEmailToken,
    hashVerifyEmailToken,
    VERIFY_EMAIL_TOKEN_TTL_MS,
};
