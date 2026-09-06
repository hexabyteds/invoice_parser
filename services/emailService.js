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
        replyTo,
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
            ...(replyTo ? { replyTo } : {}),
        });

        // Only ever non-null for an Ethereal test transport (a real SMTP
        // provider returns null here) — a convenience for local QA so the
        // caught test email is one click away, no-op in production.
        const previewUrl = nodemailer.getTestMessageUrl(result);
        if (previewUrl) {
            console.log(`📧 Email preview (${subject} -> ${to}): ${previewUrl}`);
        }

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

    // =========================
    // Email Verification
    // =========================

    async sendVerificationEmail(toEmail, verifyUrl) {
        if (!this.configured) {
            throw new Error(
                "Email sending is not configured " +
                "(SMTP_HOST/SMTP_USER/SMTP_PASSWORD)."
            );
        }

        const text =
            `Verify your email address\n\n` +
            `Confirm this is your email address to finish setting up your ` +
            `EazeeBooks account:\n\n` +
            `${verifyUrl}\n\n` +
            `This link expires in 48 hours.`;

        const html = `
            <div style="
                font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;
                max-width: 480px;
                margin: 0 auto;
                color: #1a1a1a;
                padding: 24px;
            ">
                <h2 style="margin-bottom: 8px;">
                    Verify your email address
                </h2>

                <p>
                    Confirm this is your email address to finish setting up
                    your EazeeBooks account.
                </p>

                <p style="margin: 24px 0;">
                    <a
                        href="${verifyUrl}"
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
                        Verify Email
                    </a>
                </p>

                <p style="
                    color: #666;
                    font-size: 14px;
                ">
                    This link expires in 48 hours.
                </p>
            </div>
        `;

        return this.sendEmail({
            to: toEmail,
            subject: "Verify your EazeeBooks email address",
            text,
            html,
        });
    }

    // =========================
    // Company Invitations
    // =========================

    async sendCompanyInvitationEmail(toEmail, { companyName, inviterName, acceptUrl, expiresInDays }) {
        if (!this.configured) {
            throw new Error(
                "Email sending is not configured " +
                "(SMTP_HOST/SMTP_USER/SMTP_PASSWORD)."
            );
        }

        const text =
            `You've been invited to manage ${companyName} on EazeeBooks\n\n` +
            `${inviterName ? inviterName + " has" : "You've been"} invited you to manage ` +
            `${companyName}'s invoices, bills, customers and suppliers on EazeeBooks.\n\n` +
            `Accept the invitation:\n\n` +
            `${acceptUrl}\n\n` +
            `This invitation expires in ${expiresInDays} days. ` +
            `If you weren't expecting this, you can safely ignore this email.`;

        const html = `
            <div style="
                font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;
                max-width: 480px;
                margin: 0 auto;
                color: #1a1a1a;
                padding: 24px;
            ">
                <h2 style="margin-bottom: 8px;">
                    You've been invited to manage ${companyName}
                </h2>

                <p>
                    ${inviterName ? `${inviterName} has` : "You've been"} invited you to manage
                    <strong>${companyName}</strong>'s invoices, bills, customers and
                    suppliers on EazeeBooks.
                </p>

                <p style="margin: 24px 0;">
                    <a
                        href="${acceptUrl}"
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
                        Accept Invitation
                    </a>
                </p>

                <p style="
                    color: #666;
                    font-size: 14px;
                ">
                    This invitation expires in ${expiresInDays} days.
                </p>

                <p style="
                    color: #666;
                    font-size: 14px;
                ">
                    If you weren't expecting this, you can safely ignore this email.
                </p>
            </div>
        `;

        return this.sendEmail({
            to: toEmail,
            subject: `You've been invited to manage ${companyName} on EazeeBooks`,
            text,
            html,
        });
    }

    async sendInvitationAcceptedEmailToFreelancer(toEmail, { companyName }) {
        return this.sendEmail({
            to: toEmail,
            subject: `You're now connected to ${companyName}`,
            text: `You've accepted the invitation to manage ${companyName} on EazeeBooks. You can switch to it any time from your company switcher.`,
            html: `<p style="font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;">You've accepted the invitation to manage <strong>${companyName}</strong> on EazeeBooks. You can switch to it any time from your company switcher.</p>`,
        });
    }

    async sendInvitationAcceptedEmailToInviter(toEmail, { freelancerName, companyName }) {
        return this.sendEmail({
            to: toEmail,
            subject: `${freelancerName} accepted your invitation`,
            text: `${freelancerName} has accepted your invitation to manage ${companyName} and now has access based on the permissions you assigned.`,
            html: `<p style="font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;">${freelancerName} has accepted your invitation to manage <strong>${companyName}</strong> and now has access based on the permissions you assigned.</p>`,
        });
    }
}

module.exports = new EmailService();