const contactService = require("../services/contactService");

class ContactController {

    async submit(req, res) {

        try {

            await contactService.submitContactMessage({
                name: req.body.name,
                email: req.body.email,
                message: req.body.message,
                honeypot: req.body.company_website,
            });

            res.json({
                success: true,
                message: "Thanks for reaching out — we'll get back to you soon.",
            });

        } catch (err) {

            console.log("Contact form error:", err);

            // err.message here is always one of contactService's own
            // validation strings — safe to show. Anything unexpected
            // (SMTP not configured, transporter failure, etc.) gets a
            // generic message instead of leaking internals.
            const isValidationError = err.message && !/smtp|email sending/i.test(err.message);

            res.status(400).json({
                success: false,
                error: isValidationError
                    ? err.message
                    : "We couldn't send your message right now. Please try again later or email us directly.",
            });

        }

    }

}

module.exports = new ContactController();
