const companyRepository = require("../repositories/companyRepository");
const userRepository = require("../repositories/userRepository");

function toPublicMembership(row) {
    return {
        id: row.id,
        companyId: row.company_id,
        companyName: row.company_name,
        companyStatus: row.company_status,
        role: row.role,
        status: row.status,
        permissions: row.permissions || null,
        invitedAt: row.invited_at,
        acceptedAt: row.accepted_at,
    };
}

function toPublicMember(row) {
    return {
        membershipId: row.id,
        userId: row.user_id,
        name: row.name,
        email: row.email,
        role: row.role,
        status: row.status,
        permissions: row.permissions || null,
        invitedAt: row.invited_at,
        acceptedAt: row.accepted_at,
        removedAt: row.removed_at,
    };
}

class CompanyService {

    // Splits one user's memberships into workspaces they can already act in
    // vs. invitations still awaiting their response — used to hydrate
    // AuthContext (via authService.me) with everything the frontend needs
    // to render "My Companies" / the workspace switcher / a pending-invite
    // banner, without a separate round trip.
    async getMembershipsForUser(userId) {
        const rows = await companyRepository.findMembershipsForUser(userId);

        return {
            companies: rows
                .filter(r => r.status === "ACTIVE")
                .map(toPublicMembership),
            invitations: rows
                .filter(r => r.status === "INVITED")
                .map(toPublicMembership),
        };
    }

    async acceptInvitation(membershipId, userId) {
        const membership = await companyRepository.findMembershipForUser(membershipId, userId);

        if (!membership) {
            throw new Error("Invitation not found.");
        }

        if (membership.status !== "INVITED") {
            throw new Error("This invitation is no longer pending.");
        }

        await companyRepository.updateMembershipStatus(membershipId, "ACTIVE", { acceptedAt: true });
    }

    // Declining before ever accepting never became a real membership, so
    // the row is deleted outright rather than kept as e.g. a "DECLINED"
    // status — there's no relationship history worth preserving yet (unlike
    // removal, which does keep a REMOVED row — see removeMember).
    async declineInvitation(membershipId, userId) {
        const membership = await companyRepository.findMembershipForUser(membershipId, userId);

        if (!membership) {
            throw new Error("Invitation not found.");
        }

        if (membership.status !== "INVITED") {
            throw new Error("This invitation is no longer pending.");
        }

        await companyRepository.deleteMembership(membershipId);
    }

    // Only an existing FREELANCER account can be invited — a COMPANY
    // account owns its own workspace and was never meant to also operate
    // inside someone else's (see the architecture's Company-vs-Freelancer
    // split). Requiring the account to already exist (rather than inviting
    // a bare email) is a deliberate v1 scope cut: no pending-invite-by-email
    // token/email-send flow yet, just an in-app pending list for the invited
    // user to see once they sign in.
    async inviteFreelancer(companyId, invitedByUserId, email, permissions = null) {
        const trimmedEmail = (email || "").trim().toLowerCase();

        if (!trimmedEmail) {
            throw new Error("Email is required.");
        }

        const user = await userRepository.findByEmail(trimmedEmail);

        if (!user) {
            throw new Error("No account found with that email. They need to sign up as a Freelancer first.");
        }

        if (user.account_type !== "FREELANCER") {
            throw new Error("This email belongs to a Company account, not a Freelancer account.");
        }

        const existing = await companyRepository.findMembershipByCompanyAndUser(companyId, user.id);

        if (existing) {
            throw new Error(
                existing.status === "REMOVED"
                    ? "This freelancer was previously removed. Reactivate them instead of re-inviting."
                    : "This freelancer is already invited or active on this company."
            );
        }

        return await companyRepository.createMembership({
            companyId,
            userId: user.id,
            role: "FREELANCER",
            status: "INVITED",
            invitedBy: invitedByUserId,
            permissions,
        });
    }

    async listMembers(companyId) {
        const rows = await companyRepository.findMembersForCompany(companyId);
        return rows.map(toPublicMember);
    }

    // Shared guard for every team-management mutation below: the target
    // membership must actually belong to the acting company, and the
    // company's OWNER membership itself can never be modified through this
    // path (no deactivating/removing/permission-editing the owner).
    async assertMutableMember(membershipId, companyId) {
        const membership = await companyRepository.findMembershipForCompany(membershipId, companyId);

        if (!membership) {
            throw new Error("Team member not found.");
        }

        if (membership.role === "OWNER") {
            throw new Error("The company owner's access can't be changed here.");
        }

        return membership;
    }

    async setMemberStatus(companyId, membershipId, status) {
        if (!["ACTIVE", "SUSPENDED", "REMOVED"].includes(status)) {
            throw new Error("Invalid status.");
        }

        await this.assertMutableMember(membershipId, companyId);
        await companyRepository.updateMemberStatusForCompany(membershipId, companyId, status);
    }

    async setMemberPermissions(companyId, membershipId, permissions) {
        await this.assertMutableMember(membershipId, companyId);

        if (typeof permissions !== "object" || permissions === null || Array.isArray(permissions)) {
            throw new Error("Permissions must be an object of module -> action list.");
        }

        await companyRepository.updateMemberPermissionsForCompany(membershipId, companyId, permissions);
    }
}

module.exports = new CompanyService();
