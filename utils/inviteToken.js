const crypto = require("crypto");

const INVITE_TOKEN_TTL_MS =
    (Number(process.env.COMPANY_INVITE_TTL_DAYS) || 7) * 24 * 60 * 60 * 1000;

// Same principle as utils/resetToken.js: the raw token is what's emailed
// and embedded in the invite link — it's never stored. Only its SHA-256
// hash is stored, so a DB leak alone can't hand out usable invite links.
function generateInviteToken() {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);

    return { token, tokenHash, expiresAt };
}

function hashInviteToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
    generateInviteToken,
    hashInviteToken,
    INVITE_TOKEN_TTL_MS,
};
