const userRepository = require("../repositories/userRepository");
const subscriptionService = require("./subscriptionService");
const usageService = require("./usageService");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");
const { fromDbStatus, isAccountActive } = require("../utils/userStatus");

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
            console.log("Incoming data:", data);

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
}

module.exports = new AuthService();
