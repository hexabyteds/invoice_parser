const companyRepository = require("../repositories/companyRepository");
const userRepository = require("../repositories/userRepository");
const subscriptionService = require("./subscriptionService");
const usageService = require("./usageService");
const auditLogRepository = require("../repositories/auditLogRepository");

function toPublicCompany(row) {
    return {
        id: row.id,
        name: row.name,
        address: row.address || null,
        phone: row.phone || null,
        email: row.email || null,
        trn: row.trn || null,
        status: row.status,
    };
}

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

    // A Freelancer's self-service way to start managing a new business,
    // separate from the invite-only path above (Company invites Freelancer).
    // Mirrors authService.register's COMPANY-account bootstrap exactly
    // (company row + OWNER membership + free subscription + usage record)
    // so a freelancer-created company behaves identically to one created
    // via direct Company signup — same plan, same limits, same shape.
    // Restricted to FREELANCER accounts: a COMPANY account already owns
    // its one workspace from registration and was never meant to also
    // spin up additional ones through this path.
    async createCompany(userId, data) {
        const user = await userRepository.findById(userId);

        if (!user || user.account_type !== "FREELANCER") {
            throw new Error("Only Freelancer accounts can create additional companies.");
        }

        const trimmedName = (data.name || "").trim();

        if (!trimmedName) {
            throw new Error("Company name is required.");
        }

        // Reserves the slot atomically against the Freelancer's own plan
        // (see usageService.reserveCompanySlot) — before the company row
        // itself exists, since that's exactly what this check gates.
        await usageService.reserveCompanySlot(userId);

        let companyId;

        try {
            companyId = await companyRepository.create({
                name: trimmedName,
                ownerUserId: userId,
                address: data.address?.trim() || null,
                phone: data.phone?.trim() || null,
                email: data.email?.trim() || null,
                trn: data.trn?.trim() || null,
            });

            await companyRepository.createMembership({
                companyId,
                userId,
                role: "OWNER",
                status: "ACTIVE",
            });

            // A Freelancer-owned company's plan/limits are governed by the
            // Freelancer's own account-level subscription (see
            // usageService.getPlanLimits), not a subscription of its own —
            // just make sure the Freelancer's exists (lazy-Free like before).
            await subscriptionService.createFreeSubscriptionForUser(userId);
            await usageService.ensureUsageRecord(companyId);
        } catch (err) {
            await usageService.decrementCompanySlot(userId);
            throw err;
        }

        try {
            await auditLogRepository.create({
                userId,
                companyId,
                action: "company_created",
                module: "Company",
                status: "SUCCESS",
                description: `Company "${trimmedName}" created`,
            });
        } catch (logErr) {}

        return companyId;
    }

    async getCompanyDetails(companyId) {
        const company = await companyRepository.findById(companyId);

        if (!company) {
            throw new Error("Company not found.");
        }

        return toPublicCompany(company);
    }

    // Only the OWNER's own company can be edited through this path (same
    // rule as the rest of Team & Access — see assertMutableMember), and
    // only via the caller's currently-selected company (req.company.id),
    // so a Freelancer can never edit a company they're merely a member of.
    async updateCompanyDetails(companyId, userId, data) {
        const company = await companyRepository.findById(companyId);

        if (!company || company.owner_user_id !== userId) {
            throw new Error("Only the company owner can edit its details.");
        }

        const trimmedName = (data.name || "").trim();

        if (!trimmedName) {
            throw new Error("Company name is required.");
        }

        await companyRepository.update(companyId, {
            name: trimmedName,
            address: data.address?.trim() || null,
            phone: data.phone?.trim() || null,
            email: data.email?.trim() || null,
            trn: data.trn?.trim() || null,
        });
    }

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

        const membershipId = await companyRepository.createMembership({
            companyId,
            userId: user.id,
            role: "FREELANCER",
            status: "INVITED",
            invitedBy: invitedByUserId,
            permissions,
        });

        try {
            await auditLogRepository.create({
                userId: invitedByUserId,
                companyId,
                action: "freelancer_access_granted",
                module: "Freelancer",
                status: "SUCCESS",
                description: `Invited ${trimmedEmail} as Freelancer`,
            });
        } catch (logErr) {}

        return membershipId;
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

        const membership = await this.assertMutableMember(membershipId, companyId);
        await companyRepository.updateMemberStatusForCompany(membershipId, companyId, status);

        try {
            await auditLogRepository.create({
                userId: membership.user_id,
                companyId,
                action: status === "REMOVED" ? "freelancer_access_revoked" : "freelancer_access_changed",
                module: "Freelancer",
                status: "SUCCESS",
                description: `Access ${status.toLowerCase()} for membership #${membershipId}`,
            });
        } catch (logErr) {}
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
