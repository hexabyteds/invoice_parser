const userRepository = require("../repositories/userRepository");
const loginHistoryRepository = require("../repositories/loginHistoryRepository");
const subscriptionService = require("./subscriptionService");
const usageService = require("./usageService");
const emailService = require("./emailService");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");
const { fromDbStatus, isAccountActive } = require("../utils/userStatus");
const { generateResetToken, hashResetToken } = require("../utils/resetToken");
const { validateCountryAndCode } = require("../utils/countries");
const { normalizeMobileNumber } = require("../utils/phone");
const { parseUserAgent } = require("../utils/userAgent");

// Matches the policy already enforced client-side by RegisterForm.jsx and
// ResetPassword.jsx's zod schemas — those only stop a browser form
// submission, not a direct API call, so the same rule needs to hold here
// too (BUG-AUTH-001: a 1-character password was previously accepted).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmailFormat(email) {
    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
        throw new Error("Please enter a valid email address.");
    }
}

function validatePasswordPolicy(password) {
    if (!password || typeof password !== "string") {
        throw new Error("Password is required.");
    }

    if (password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
    }

    if (!/[A-Z]/.test(password)) {
        throw new Error("Password must contain an uppercase letter.");
    }

    if (!/[a-z]/.test(password)) {
        throw new Error("Password must contain a lowercase letter.");
    }

    if (!/[0-9]/.test(password)) {
        throw new Error("Password must contain a number.");
    }
}

function toPublicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        company_name: user.company_name,
        country: user.country || null,
        country_code: user.country_code || null,
        mobile_number: user.mobile_number || null,
        role: user.role || "customer",
        plan: user.plan || "free",
        status: fromDbStatus(user.status, user.deleted_at),
    };
}

function toPublicSubscription(subscription) {
    if (!subscription) {
        return null;
    }

    return {
        id: subscription.id,
        plan_id: subscription.plan_id,
        plan: subscription.slug || subscription.name,
        status: subscription.status,
        billing_cycle: subscription.billing_cycle,
        starts_at: subscription.starts_at,
        expires_at: subscription.expires_at,
    };
}

class AuthService {
    async register(data) {
        try {
            console.log("Incoming data:", { ...data, password: "[redacted]" });

            validateEmailFormat(data.email);
            validatePasswordPolicy(data.password);

            // Mandatory for every new signup — see utils/countries.js and
            // utils/phone.js. Existing accounts predating this change are
            // untouched (columns are nullable; see migration 0011).
            const { country, countryCode } = validateCountryAndCode(
                data.country,
                data.country_code
            );
            const mobileNumber = normalizeMobileNumber(
                countryCode,
                data.mobile_number
            );

            const existingUser = await userRepository.findByEmail(data.email);
            console.log("Existing user:", existingUser);

            if (existingUser) {
                throw new Error("Email already exists.");
            }

            const existingMobile = await userRepository.findByCountryCodeAndMobile(
                countryCode,
                mobileNumber
            );

            if (existingMobile) {
                throw new Error("An account with this mobile number already exists.");
            }

            const password = await hashPassword(data.password);

            const id = await userRepository.create({
                name: data.name?.trim(),
                company_name: data.company_name?.trim() ?? null,
                email: data.email?.trim().toLowerCase(),
                country,
                country_code: countryCode,
                mobile_number: mobileNumber,
                password,
                plan: "FREE",
            });

            console.log("Created ID:", id);

            let subscription;

            try {
                subscription = await subscriptionService.createFreeSubscription(id);
                await usageService.ensureUsageRecord(id);
            } catch (subscriptionError) {
                await userRepository.delete(id);
                throw subscriptionError;
            }

            const user = await userRepository.findById(id);
            const token = generateToken(user);

            return {
                user: toPublicUser(user),
                subscription: toPublicSubscription(subscription),
                token,
            };
        } catch (err) {
            console.error("Register Error:", err);
            throw err;
        }
    }

    async login(email, password, requestMeta = {}) {
        const user = await userRepository.findByEmail(email);

        if (!user) {
            throw new Error("Invalid email or password.");
        }

        const valid = await comparePassword(password, user.password);

        if (!valid) {
            throw new Error("Invalid email or password.");
        }

        if (user.deleted_at) {
            throw new Error("This account has been deleted.");
        }

        if (!isAccountActive(user.status, user.deleted_at)) {
            throw new Error("This account has been suspended.");
        }

        const token = generateToken(user);

        // Best-effort — a login_history write must never block a
        // successful login (same "try/catch and swallow" pattern used for
        // audit_logs elsewhere, e.g. app-backend.js's bank-statement routes).
        try {
            const { browser, device } = parseUserAgent(requestMeta.userAgent);

            await loginHistoryRepository.create({
                userId: user.id,
                ipAddress: requestMeta.ipAddress || null,
                browser,
                device,
            });
        } catch (logErr) {}

        return {
            token,
            user: toPublicUser(user),
        };
    }

    async getLoginHistory(userId, limit = 20) {
        const rows = await loginHistoryRepository.findByUserId(userId, limit);

        return rows.map((row) => ({
            id: row.id,
            ip_address: row.ip_address,
            browser: row.browser,
            device: row.device,
            login_time: row.login_time,
            logout_time: row.logout_time,
        }));
    }

    async me(id) {
        const user = await userRepository.findById(id);

        if (!user) {
            throw new Error("User not found.");
        }

        return toPublicUser(user);
    }

    async updateProfile(id, data) {
        if (!data.name || !data.name.trim()) {
            throw new Error("Name is required.");
        }

        const updates = {
            name: data.name.trim(),
            company_name: (data.company_name || "").trim(),
        };

        // Country/country_code/mobile_number are optional on this endpoint
        // (pre-existing accounts may not have them yet — see migration
        // 0011), but the moment the caller touches any one of them, all
        // three must be present and consistent, same as at signup.
        const touchesContactFields =
            data.country !== undefined ||
            data.country_code !== undefined ||
            data.mobile_number !== undefined;

        if (touchesContactFields) {
            const { country, countryCode } = validateCountryAndCode(
                data.country,
                data.country_code
            );
            const mobileNumber = normalizeMobileNumber(
                countryCode,
                data.mobile_number
            );

            const existingMobile = await userRepository.findByCountryCodeAndMobile(
                countryCode,
                mobileNumber,
                id
            );

            if (existingMobile) {
                throw new Error("An account with this mobile number already exists.");
            }

            updates.country = country;
            updates.country_code = countryCode;
            updates.mobile_number = mobileNumber;
        }

        await userRepository.update(id, updates);

        return await this.me(id);
    }

    // Deliberately never reveals whether the email is registered — the
    // "no account / inactive account" branch just returns normally, same
    // as the "sent" branch, so the caller can't distinguish them. A
    // failure to actually send the email (e.g. SMTP misconfigured) is
    // still allowed to throw: that's a system-wide condition, not
    // specific to this email, so surfacing it doesn't leak anything.
    async forgotPassword(email) {
        const user = await userRepository.findByEmail(
            email?.trim().toLowerCase()
        );

        if (!user || !isAccountActive(user.status, user.deleted_at)) {
            return;
        }

        const { token, tokenHash, expiresAt } = generateResetToken();

        await userRepository.setResetToken(user.id, tokenHash, expiresAt);

        const resetUrl = `${
            process.env.FRONTEND_URL || "http://localhost:5173"
        }/reset-password?token=${token}`;

        await emailService.sendPasswordResetEmail(user.email, resetUrl);
    }

    async resetPassword(token, newPassword) {
        const user = token
            ? await userRepository.findByResetTokenHash(hashResetToken(token))
            : null;

        if (!user) {
            throw new Error("This reset link is invalid or has expired.");
        }

        validatePasswordPolicy(newPassword);

        const password = await hashPassword(newPassword);

        await userRepository.updatePassword(user.id, password);
        await userRepository.clearResetToken(user.id);
    }
}

module.exports = new AuthService();
