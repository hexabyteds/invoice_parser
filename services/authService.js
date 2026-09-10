const userRepository = require("../repositories/userRepository");
const loginHistoryRepository = require("../repositories/loginHistoryRepository");
const auditLogRepository = require("../repositories/auditLogRepository");
const companyRepository = require("../repositories/companyRepository");
const companyService = require("./companyService");
const subscriptionService = require("./subscriptionService");
const usageService = require("./usageService");
const emailService = require("./emailService");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");
const { fromDbStatus, isAccountActive } = require("../utils/userStatus");
const { generateResetToken, hashResetToken } = require("../utils/resetToken");
const { generateVerifyEmailToken, hashVerifyEmailToken } = require("../utils/verifyEmailToken");
const { validateCountryAndCode } = require("../utils/countries");
const { normalizeMobileNumber } = require("../utils/phone");
const { parseUserAgent } = require("../utils/userAgent");
const { getTrialInfo } = require("../utils/subscriptionAccess");

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
        account_type: user.account_type || null,
        email_verified: Boolean(user.email_verified),
    };
}

function validateAccountType(accountType) {
    if (accountType !== "COMPANY" && accountType !== "FREELANCER") {
        throw new Error('Account type must be "COMPANY" or "FREELANCER".');
    }
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
        trial: getTrialInfo(subscription),
    };
}

// Shared by login() and me() — a Freelancer's plan is account-level
// (governs every company they own uniformly), a Company account's is
// tied to the company they own. Lazily creates a Free/trial subscription
// on first resolution if none exists yet, same fallback
// resolveSubscriptionForCompany/getFreelancerLimits already use — so a
// Freelancer who hasn't created a company yet still sees accurate trial
// info instead of none at all. Best-effort: a resolution failure (e.g. a
// Company account with no owned company yet) must never break login/me.
async function resolveSubscriptionForUser(user, companies) {
    try {
        if (user.account_type === "FREELANCER") {
            try {
                return await subscriptionService.getCurrentSubscriptionForUser(user.id);
            } catch (error) {
                if (error.message === "No active subscription found.") {
                    return await subscriptionService.createFreeSubscriptionForUser(user.id);
                }
                throw error;
            }
        }

        const ownedCompanyId = companies.find((c) => c.role === "OWNER")?.companyId;

        if (!ownedCompanyId) {
            return null;
        }

        const { subscription } = await subscriptionService.resolveSubscriptionForCompany(ownedCompanyId);
        return subscription;
    } catch (err) {
        return null;
    }
}

class AuthService {
    async register(data, requestMeta = {}) {
        try {
            console.log("Incoming data:", { ...data, password: "[redacted]" });

            validateEmailFormat(data.email);
            validatePasswordPolicy(data.password);
            validateAccountType(data.account_type);

            if (!data.name?.trim()) {
                throw new Error("Name is required.");
            }

            if (data.account_type === "COMPANY" && !data.company_name?.trim()) {
                throw new Error("Company name is required.");
            }

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

            // Trimmed/lowercased — matching what's actually persisted below
            // (userRepository.create writes data.email?.trim().toLowerCase()).
            // Checking the raw value here let a whitespace-padded duplicate
            // ("  test@example.test  ") slip past this check and fail at
            // INSERT time instead, surfacing a raw MySQL constraint error
            // to the client rather than this clean message (QA audit BUG-QA-05).
            const existingUser = await userRepository.findByEmail(
                data.email?.trim().toLowerCase()
            );
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
                company_name: data.account_type === "COMPANY" ? data.company_name?.trim() : null,
                email: data.email?.trim().toLowerCase(),
                country,
                country_code: countryCode,
                mobile_number: mobileNumber,
                password,
                plan: "FREE",
                account_type: data.account_type,
            });

            console.log("Created ID:", id);

            // A Company account owns a workspace from the moment it signs
            // up — create it (and the OWNER membership) alongside the user,
            // same transaction-by-cleanup pattern as the subscription below.
            // A Freelancer owns no workspace and gets neither a company nor
            // a personal subscription/usage record: usage_stats.company_id
            // is NOT NULL (see migration 0013) and there's no company yet
            // to attach it to — a freelancer's usage is charged to whichever
            // company they're actively working in, never to themselves.
            let subscription = null;

            try {
                if (data.account_type === "COMPANY") {
                    const companyId = await companyRepository.create({
                        name: data.company_name.trim(),
                        ownerUserId: id,
                    });

                    await companyRepository.createMembership({
                        companyId,
                        userId: id,
                        role: "OWNER",
                        status: "ACTIVE",
                    });

                    subscription = await subscriptionService.createFreeSubscription(companyId);
                    await usageService.ensureUsageRecord(companyId);
                }
            } catch (subscriptionError) {
                await userRepository.delete(id);
                throw subscriptionError;
            }

            // Freelancer Independent Signup + Company-to-Freelancer
            // Invitation, Case A: completing signup via an invite link
            // auto-accepts it, so the new freelancer lands on their
            // dashboard already connected to the inviting company — no
            // manual "add company" step. Re-validated here server-side
            // even though the frontend already checked the token when the
            // page loaded (never rely only on frontend checks) — best
            // effort: the token could theoretically be consumed by someone
            // else in the moments between page-load and form-submit, and
            // that race must never fail the signup itself, just skip the
            // auto-connect.
            let invitationAccepted = true;

            if (data.account_type === "FREELANCER" && data.invitation_token) {
                try {
                    await companyService.acceptInvitationByToken(
                        data.invitation_token,
                        id,
                        data.email?.trim().toLowerCase()
                    );
                } catch (invitationError) {
                    console.error("Auto-accept invitation on signup failed:", invitationError.message);
                    invitationAccepted = false;
                }
            }

            // Best-effort, same reasoning as invitation emails — SMTP may
            // not be configured in every environment, and that must never
            // fail signup itself. Verification stays available via
            // "resend" once email works.
            let emailVerificationSent = false;

            try {
                const { token: verifyToken, tokenHash, expiresAt } = generateVerifyEmailToken();
                await userRepository.setEmailVerifyToken(id, tokenHash, expiresAt);

                const verifyUrl = `${
                    process.env.FRONTEND_URL || "http://localhost:5173"
                }/verify-email?token=${verifyToken}`;

                await emailService.sendVerificationEmail(data.email?.trim().toLowerCase(), verifyUrl);
                emailVerificationSent = true;
            } catch (verifyErr) {
                console.error("Failed to send verification email:", verifyErr.message);
            }

            const user = await userRepository.findById(id);
            const token = generateToken(user);

            // Same enrichment as login()/me() — RegisterForm.jsx logs the
            // caller in immediately from this response (no follow-up
            // GET /auth/me), so a Freelancer who just signed up via an
            // invite link must see the now-accepted company here, not only
            // after a later refresh.
            const { companies, invitations } = await companyService.getMembershipsForUser(id, user.email);

            // Best-effort — never blocks a successful registration, same
            // "try/catch and swallow" pattern login() uses for its own
            // audit_logs write. Registration previously logged nothing at
            // all (no IP, no audit trail), which left every signup
            // unforensicable after the fact.
            try {
                await auditLogRepository.create({
                    userId: user.id,
                    action: "register",
                    module: "Authentication",
                    status: "SUCCESS",
                    description: `${user.name} registered a new ${user.account_type || ""} account`.trim(),
                    ipAddress: requestMeta.ipAddress || null,
                });
            } catch (logErr) {}

            return {
                user: { ...toPublicUser(user), companies, invitations },
                subscription: toPublicSubscription(subscription),
                token,
                emailVerificationSent,
                invitationAccepted: data.invitation_token ? invitationAccepted : null,
            };
        } catch (err) {
            console.error("Register Error:", err);

            try {
                await auditLogRepository.create({
                    userId: null,
                    action: "register_failed",
                    module: "Authentication",
                    status: "FAILED",
                    description: `Failed registration attempt for ${data.email || "unknown email"}: ${err.message}`,
                    ipAddress: requestMeta.ipAddress || null,
                });
            } catch (logErr) {}

            throw err;
        }
    }

    async login(email, password, requestMeta = {}) {
        const user = await userRepository.findByEmail(email);

        if (!user) {
            try {
                await auditLogRepository.create({
                    userId: null,
                    action: "login_failed",
                    module: "Authentication",
                    status: "FAILED",
                    description: `Failed login attempt for ${email}`,
                    ipAddress: requestMeta.ipAddress || null,
                });
            } catch (logErr) {}
            throw new Error("Invalid email or password.");
        }

        const valid = await comparePassword(password, user.password);

        if (!valid) {
            try {
                await auditLogRepository.create({
                    userId: user.id,
                    action: "login_failed",
                    module: "Authentication",
                    status: "FAILED",
                    description: "Incorrect password",
                    ipAddress: requestMeta.ipAddress || null,
                });
            } catch (logErr) {}
            throw new Error("Invalid email or password.");
        }

        if (user.deleted_at) {
            throw new Error("This account has been deleted.");
        }

        if (!isAccountActive(user.status, user.deleted_at)) {
            throw new Error("This account has been suspended.");
        }

        const token = generateToken(user);

        try {
            await auditLogRepository.create({
                userId: user.id,
                action: "login",
                module: "Authentication",
                status: "SUCCESS",
                description: `${user.name} logged in`,
                ipAddress: requestMeta.ipAddress || null,
            });
        } catch (logErr) {}

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

        // Same enrichment as me() — the frontend's AuthContext.login() uses
        // this response directly (not a follow-up GET /auth/me), so the
        // workspace switcher, pending-invitations, and trial/subscription
        // state must be correct from the first response, not just after a
        // later refresh.
        const { companies, invitations } = await companyService.getMembershipsForUser(user.id, user.email);
        const subscription = await resolveSubscriptionForUser(user, companies);

        return {
            token,
            user: {
                ...toPublicUser(user),
                companies,
                invitations,
                subscription: toPublicSubscription(subscription),
            },
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

    // Also returns the caller's companies (active memberships — this is
    // what the frontend's workspace switcher is built from) and pending
    // invitations, so AuthContext gets everything it needs to render the
    // logged-in shell in one round trip instead of a second fetch.
    async me(id) {
        const user = await userRepository.findById(id);

        if (!user) {
            throw new Error("User not found.");
        }

        const { companies, invitations } = await companyService.getMembershipsForUser(id, user.email);
        const subscription = await resolveSubscriptionForUser(user, companies);

        return {
            ...toPublicUser(user),
            companies,
            invitations,
            subscription: toPublicSubscription(subscription),
        };
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

    async verifyEmail(token) {
        const user = token
            ? await userRepository.findByEmailVerifyTokenHash(hashVerifyEmailToken(token))
            : null;

        if (!user) {
            throw new Error("This verification link is invalid or has expired.");
        }

        await userRepository.markEmailVerified(user.id);
    }

    // Deliberately silent on "already verified" / "no such user" — same
    // non-revealing pattern as forgotPassword. A signed-in caller only
    // reaches this from their own account, so there's no enumeration risk
    // to weigh against usability here, but staying quiet keeps the
    // behavior consistent and simple.
    async resendVerificationEmail(userId) {
        const user = await userRepository.findById(userId);

        if (!user || user.email_verified) {
            return;
        }

        const { token, tokenHash, expiresAt } = generateVerifyEmailToken();
        await userRepository.setEmailVerifyToken(userId, tokenHash, expiresAt);

        const verifyUrl = `${
            process.env.FRONTEND_URL || "http://localhost:5173"
        }/verify-email?token=${token}`;

        await emailService.sendVerificationEmail(user.email, verifyUrl);
    }
}

module.exports = new AuthService();
