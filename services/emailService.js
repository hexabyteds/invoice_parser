const nodemailer = require("nodemailer");

class EmailService {
    constructor() {
        this.configured = Boolean(
            process.env.SMTP_HOST &&
            process.env.SMTP_USER &&
            process.env.SMTP_PASSWORD
        );

        if (this.configured) {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 465,
                secure: process.env.SMTP_SECURE === "true",
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD,
                },
            });
        }

        this.fromEmail =
            process.env.SMTP_FROM_EMAIL ||
            process.env.SMTP_USER;

        this.fromName =
            process.env.SMTP_FROM_NAME ||
            "EazeeBooks";
    }

    // =========================
    // Verify SMTP connection
    // =========================

    async verifyConnection() {
        if (!this.configured) {
            throw new Error(
                "Email sending is not configured. " +
                "Check SMTP_HOST, SMTP_USER and SMTP_PASSWORD."
            );
        }

        await this.transporter.verify();

        console.log("✅ SMTP connection successful");

        return true;
    }

    // =========================
    // Send generic email
    // =========================

    async sendEmail({
        to,
        subject,
        text,
        html,
    }) {
        if (!this.configured) {
            throw new Error(
                "Email sending is not configured. " +
                "Check SMTP_HOST, SMTP_USER and SMTP_PASSWORD."
            );
        }

        const result = await this.transporter.sendMail({
            from: `"${this.fromName}" <${this.fromEmail}>`,
            to,
            subject,
            text,
            html,
        });

        return result;
    }

    // =========================
    // Password Reset
    // =========================

    async sendPasswordResetEmail(toEmail, resetUrl) {
        if (!this.configured) {
            throw new Error(
                "Email sending is not configured " +
                "(SMTP_HOST/SMTP_USER/SMTP_PASSWORD)."
            );
        }

        const text =
            `Reset your EazeeBooks password\n\n` +
            `We received a request to reset your password. ` +
            `Open this link to choose a new one:\n\n` +
            `${resetUrl}\n\n` +
            `This link expires in 1 hour. ` +
            `If you didn't request this, you can safely ignore ` +
            `this email — your password won't be changed.`;

        const html = `
            <div style="
                font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;
                max-width: 480px;
                margin: 0 auto;
                color: #1a1a1a;
                padding: 24px;
            ">
                <h2 style="margin-bottom: 8px;">
                    Reset your password
                </h2>

                <p>
                    We received a request to reset your
                    EazeeBooks password.
                </p>

                <p style="margin: 24px 0;">
                    <a
                        href="${resetUrl}"
                        style="
                            background: #2563eb;
                            color: #fff;
                            padding: 12px 24px;
                            border-radius: 8px;
                            text-decoration: none;
                            font-weight: 600;
                            display: inline-block;
                        "
                    >
                        Reset Password
                    </a>
                </p>

                <p style="
                    color: #666;
                    font-size: 14px;
                ">
                    This link expires in 1 hour.
                </p>

                <p style="
                    color: #666;
                    font-size: 14px;
                ">
                    If you didn't request this, you can safely
                    ignore this email — your password won't be changed.
                </p>
            </div>
        `;
        return this.sendEmail({
            to: toEmail,
            subject: "Reset your EazeeBooks password",
            text,
            html,
        });
    }
}

module.exports = new EmailService();