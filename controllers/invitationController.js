const companyService = require("../services/companyService");

// The emailed-link side of the invitation flow — deliberately separate
// from controllers/companyController.js's invitation endpoints, which all
// sit behind authMiddleware. validateToken here must be reachable by
// someone who isn't logged in yet (that's the whole point of Case A: a
// brand-new visitor with no account).
class InvitationController {

    async validateToken(req, res) {
        try {
            const result = await companyService.validateInvitationToken(req.params.token);
            res.json({ success: true, ...result });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    }

    async acceptByToken(req, res) {
        try {
            await companyService.acceptInvitationByToken(req.params.token, req.user.id, req.user.email);
            res.json({ success: true, message: "Invitation accepted." });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    }
}

module.exports = new InvitationController();
