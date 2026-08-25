const companyService = require("../services/companyService");

class CompanyController {

    async create(req, res) {
        try {
            const companyId = await companyService.createCompany(req.user.id, req.body);
            res.status(201).json({ success: true, companyId });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    }

    async getCurrent(req, res) {
        try {
            const company = await companyService.getCompanyDetails(req.company.id);
            res.json({ success: true, company });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    }

    async updateCurrent(req, res) {
        try {
            await companyService.updateCompanyDetails(req.company.id, req.user.id, req.body);
            res.json({ success: true, message: "Company details updated." });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    }

    async acceptInvitation(req, res) {
        try {
            await companyService.acceptInvitation(req.params.membershipId, req.user.id);
            res.json({ success: true, message: "Invitation accepted." });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    }

    async declineInvitation(req, res) {
        try {
            await companyService.declineInvitation(req.params.membershipId, req.user.id);
            res.json({ success: true, message: "Invitation declined." });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    }

    async invite(req, res) {
        try {
            await companyService.inviteFreelancer(
                req.company.id,
                req.user.id,
                req.body.email,
                req.body.permissions || null
            );
            res.status(201).json({ success: true, message: "Invitation sent." });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    }

    async listTeam(req, res) {
        try {
            const members = await companyService.listMembers(req.company.id);
            res.json({ success: true, members });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    }

    async updateMember(req, res) {
        try {
            const { status, permissions } = req.body;

            if (status) {
                await companyService.setMemberStatus(req.company.id, req.params.membershipId, status);
            }

            if (permissions) {
                await companyService.setMemberPermissions(req.company.id, req.params.membershipId, permissions);
            }

            res.json({ success: true, message: "Team member updated." });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    }

    async removeMember(req, res) {
        try {
            await companyService.setMemberStatus(req.company.id, req.params.membershipId, "REMOVED");
            res.json({ success: true, message: "Access removed." });
        } catch (err) {
            res.status(400).json({ success: false, error: err.message });
        }
    }
}

module.exports = new CompanyController();
