const userRepository = require("../repositories/userRepository");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");

class AuthService {

    // Register
    async register(data) {

        // Check existing email
        const existingUser = await userRepository.findByEmail(data.email);

        if (existingUser) {
            throw new Error("Email already exists.");
        }

        // Hash password
        const password = await hashPassword(data.password);

        // Create user
        const id = await userRepository.create({
            name: data.name,
            email: data.email,
            password
        });

        // Fetch created user
        const user = await userRepository.findById(id);

        // Generate JWT
        const token = generateToken(user);

        return {
            user,
            token
        };
    }

    // Login
    async login(email, password) {

        const user = await userRepository.findByEmail(email);

        if (!user) {
            throw new Error("Invalid email or password.");
        }

        const valid = await comparePassword(password, user.password);

        if (!valid) {
            throw new Error("Invalid email or password.");
        }

        const token = generateToken(user);

        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                status: user.status
            }
        };
    }

    // Current User
    async me(id) {

        const user = await userRepository.findById(id);

        if (!user) {
            throw new Error("User not found.");
        }

        return user;
    }

}

module.exports = new AuthService();