const userRepository = require("../repositories/userRepository");
const subscriptionService = require("./subscriptionService");
const usageService = require("./usageService");
const emailService = require("./emailService");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");
const { fromDbStatus, isAccountActive } = require("../utils/userStatus");
const { generateResetToken, hashResetToken } = require("../utils/resetToken");

function toPublicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        company_name: user.company_name,
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

            const existingUser = await userRepository.findByEmail(data.email);
            console.log("Existing user:", existingUser);

            if (existingUser) {
                throw new Error("Email already exists.");
            }

            const password = await hashPassword(data.password);

            const id = await userRepository.create({
                name: data.name?.trim(),
                company_name: data.company_name?.trim() ?? null,
                email: data.email?.trim().toLowerCase(),
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

    async login(email, password) {
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

        return {
            token,
            user: toPublicUser(user),
        };
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

        await userRepository.update(id, {
            name: data.name.trim(),
            company_name: (data.company_name || "").trim(),
        });

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

        const password = await hashPassword(newPassword);

        await userRepository.updatePassword(user.id, password);
        await userRepository.clearResetToken(user.id);
    }
}

module.exports = new AuthService();
