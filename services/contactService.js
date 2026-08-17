const emailService = require("./emailService");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CONTACT_TO_EMAIL =
    process.env.CONTACT_EMAIL ||
    process.env.SMTP_FROM_EMAIL ||
    "sales@eazeebooks.com";

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function validate({ name, email, message }) {
    const trimmedName = typeof name === "string" ? name.trim() : "";
    const trimmedEmail = typeof email === "string" ? email.trim() : "";
    const trimmedMessage = typeof message === "string" ? message.trim() : "";

    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 150) {
        throw new Error("Please enter your name.");
    }

    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
        throw new Error("Please enter a valid email address.");
    }

    if (!trimmedMessage || trimmedMessage.length < 10) {
        throw new Error("Please enter a message (at least 10 characters).");
    }

    if (trimmedMessage.length > 5000) {
        throw new Error("Message is too long (5000 characters max).");
    }

    return {
        name: trimmedName,
        email: trimmedEmail,
        message: trimmedMessage,
    };
}

class ContactService {

    // `honeypot` is a hidden field that only bots fill in — a real visitor
    // never sees or touches it. Reporting success without sending mail
    // keeps the bot from learning the field is being checked.
    async submitContactMessage({ name, email, message, honeypot }) {
        if (honeypot) {
            return { skipped: true };
        }

        const clean = validate({ name, email, message });

        const text =
            `New contact form submission\n\n` +
            `Name: ${clean.name}\n` +
            `Email: ${clean.email}\n\n` +
            `Message:\n${clean.message}`;

        const html = `
            <div style="
                font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;
                max-width: 480px;
                margin: 0 auto;
                color: #1a1a1a;
                padding: 24px;
            ">
                <h2 style="margin-bottom: 8px;">
                    New contact form submission
                </h2>

                <p><strong>Name:</strong> ${escapeHtml(clean.name)}</p>
                <p><strong>Email:</strong> ${escapeHtml(clean.email)}</p>

                <p style="margin-top: 16px;"><strong>Message:</strong></p>
                <p style="white-space: pre-wrap;">${escapeHtml(clean.message)}</p>
            </div>
        `;

        await emailService.sendEmail({
            to: CONTACT_TO_EMAIL,
            subject: `New contact form message from ${clean.name}`,
            text,
            html,
            replyTo: clean.email,
        });

        return { skipped: false };
    }
}

module.exports = new ContactService();
