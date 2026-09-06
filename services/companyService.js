const companyRepository = require("../repositories/companyRepository");
const userRepository = require("../repositories/userRepository");
const companyInvitationRepository = require("../repositories/companyInvitationRepository");
const subscriptionService = require("./subscriptionService");
const usageService = require("./usageService");
const auditLogRepository = require("../repositories/auditLogRepository");
const emailService = require("./emailService");
const { generateInviteToken, hashInviteToken } = require("../utils/inviteToken");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toPublicInvitation(row) {
    return {
        id: row.id,
        companyId: row.company_id,
        invitedEmail: row.invited_email,
        role: row.role,
        permissions: row.permissions || null,
        status: row.effective_status || row.status,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at || null,
        createdAt: row.created_at,
    };
}

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
    // `userEmail` is required to find this user's pending invitations —
    // those live in company_invitations keyed by email (an invitation can
    // exist before the invitee even has an account), not by user_id.
    async getMembershipsForUser(userId, userEmail) {
        const rows = await companyRepository.findMembershipsForUser(userId);
        const invitationRows = userEmail
            ? await companyInvitationRepository.findPendingByEmail(userEmail.trim().toLowerCase())
            : [];

        return {
            companies: rows
                .filter(r => r.status === "ACTIVE")
                .map(toPublicMembership),
            invitations: invitationRows.map((row) => ({
                id: row.id,
                companyId: row.company_id,
                companyName: row.company_name,
                companyStatus: row.company_status,
                role: row.role,
                status: "INVITED",
                permissions: row.permissions || null,
                invitedAt: row.created_at,
                acceptedAt: null,
            })),
        };
    }

    // Sends a real, token-secured invitation email to any address — the
    // invitee does NOT need an account yet (deliberate change from the old
    // v1 scope cut: this now covers "invite someone who hasn't signed up",
    // not just an in-app pending list for an existing Freelancer). Where an
    // account *does* already exist, the existing Company-vs-Freelancer
    // guard still applies — a Company account owns its own workspace and
    // was never meant to also operate inside someone else's.
    async inviteFreelancer(companyId, invitedByUserId, email, permissions = null) {
        const trimmedEmail = (email || "").trim().toLowerCase();

        if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
            throw new Error("Please enter a valid email address.");
        }

        const existingUser = await userRepository.findByEmail(trimmedEmail);

        if (existingUser) {
            if (existingUser.account_type !== "FREELANCER") {
                throw new Error("This email belongs to a Company account, not a Freelancer account.");
            }

            const existingMembership = await companyRepository.findMembershipByCompanyAndUser(companyId, existingUser.id);

            if (existingMembership && existingMembership.status !== "REMOVED") {
                throw new Error("This freelancer already has access to this company.");
            }
        }

        const existingInvitation = await companyInvitationRepository.findPendingByCompanyAndEmail(companyId, trimmedEmail);

        if (existingInvitation) {
            throw new Error("An invitation is already pending for this email. Use Resend instead of sending another.");
        }

        const { token, tokenHash, expiresAt } = generateInviteToken();

        const invitationId = await companyInvitationRepository.create({
            companyId,
            invitedEmail: trimmedEmail,
            invitedBy: invitedByUserId,
            permissions,
            tokenHash,
            expiresAt,
        });

        await this._sendInvitationEmail(companyId, invitedByUserId, trimmedEmail, token, expiresAt);

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

        return invitationId;
    }

    // Best-effort — SMTP isn't configured in every environment (e.g. local
    // dev), and a send failure must not roll back the invitation itself:
    // the row (and its token) still exists, so Resend recovers once email
    // is working. Never blocks invite creation from the caller's
    // perspective; errors are swallowed here on purpose.
    async _sendInvitationEmail(companyId, invitedByUserId, toEmail, token, expiresAt) {
        try {
            const company = await companyRepository.findById(companyId);
            const inviter = await userRepository.findById(invitedByUserId);
            const acceptUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/invite/${token}`;
            const expiresInDays = Math.max(1, Math.round((new Date(expiresAt) - Date.now()) / (24 * 60 * 60 * 1000)));

            await emailService.sendCompanyInvitationEmail(toEmail, {
                companyName: company?.name || "your company",
                inviterName: inviter?.name || null,
                acceptUrl,
                expiresInDays,
            });
        } catch (err) {
            console.error("Failed to send invitation email:", err.message);
        }
    }

    async listInvitations(companyId) {
        const rows = await companyInvitationRepository.findByCompany(companyId);
        return rows.map(toPublicInvitation);
    }

    // Regenerates the token+expiry (invalidating any previously-sent link)
    // and re-sends the email — the only recovery path once "Resend instead
    // of sending another" blocks a second invite, and also how an EXPIRED
    // invitation is revived without creating a duplicate row.
    async resendInvitation(companyId, invitationId) {
        const invitation = await companyInvitationRepository.findByCompanyAndId(companyId, invitationId);

        if (!invitation) {
            throw new Error("Invitation not found.");
        }

        if (invitation.status !== "PENDING") {
            throw new Error("Only a pending or expired invitation can be resent.");
        }

        const { token, tokenHash, expiresAt } = generateInviteToken();
        await companyInvitationRepository.regenerateToken(invitationId, tokenHash, expiresAt);
        await this._sendInvitationEmail(companyId, invitation.invited_by, invitation.invited_email, token, expiresAt);
    }

    async revokeInvitation(companyId, invitationId) {
        const invitation = await companyInvitationRepository.findByCompanyAndId(companyId, invitationId);

        if (!invitation) {
            throw new Error("Invitation not found.");
        }

        const revoked = await companyInvitationRepository.markRevoked(invitationId);

        if (!revoked) {
            throw new Error("Only a pending invitation can be revoked.");
        }
    }

    // Public-safe preview for the invitation-acceptance screen — deliberately
    // excludes anything about the company beyond its name (no address, TRN,
    // etc.) since this is reachable by anyone holding the link, before any
    // authentication.
    async validateInvitationToken(token) {
        const tokenHash = hashInviteToken(token);
        const invitation = await companyInvitationRepository.findByTokenHash(tokenHash);

        if (!invitation) {
            return { valid: false };
        }

        const company = await companyRepository.findById(invitation.company_id);
        const inviter = await userRepository.findById(invitation.invited_by);
        const accountExists = Boolean(await userRepository.findByEmail(invitation.invited_email));

        return {
            valid: true,
            // Not secrets — an invitation id/company id grants nothing on
            // its own (every mutating endpoint re-checks the token or the
            // caller's authenticated email server-side); exposed purely so
            // the frontend can call the in-app decline action without a
            // second lookup.
            id: invitation.id,
            companyId: invitation.company_id,
            companyName: company?.name || null,
            inviterName: inviter?.name || null,
            role: invitation.role,
            permissions: invitation.permissions || null,
            invitedEmail: invitation.invited_email,
            expiresAt: invitation.expires_at,
            accountExists,
        };
    }

    // Shared by both acceptance paths (emailed token, and in-app for a
    // logged-in freelancer whose email matches) — the accept UPDATE is
    // conditional on status='PENDING' (see companyInvitationRepository
    // .markAccepted) so a race between the two paths, or a double-click,
    // can only ever succeed once.
    async _finalizeAcceptance(invitation, userId) {
        const accepted = await companyInvitationRepository.markAccepted(invitation.id, userId);

        if (!accepted) {
            throw new Error("This invitation is no longer valid.");
        }

        const existingMembership = await companyRepository.findMembershipByCompanyAndUser(invitation.company_id, userId);

        if (!existingMembership || existingMembership.status !== "ACTIVE") {
            if (existingMembership) {
                await companyRepository.updateMemberStatusForCompany(existingMembership.id, invitation.company_id, "ACTIVE");
            } else {
                await companyRepository.createMembership({
                    companyId: invitation.company_id,
                    userId,
                    role: invitation.role,
                    status: "ACTIVE",
                    invitedBy: invitation.invited_by,
                    permissions: invitation.permissions,
                });
            }
        }

        // Whether an invited company counts toward the Freelancer's own
        // company-quota is a business-rule call, not an architectural one —
        // gated behind one env flag reusing the exact same counter
        // independent company creation already uses (usageService
        // .reserveCompanySlot), so flipping it on/off never needs a code
        // change. Best-effort: a quota failure here must not undo an
        // already-granted, real company relationship.
        if (process.env.COUNT_INVITED_COMPANIES_TOWARD_QUOTA === "true") {
            try {
                await usageService.reserveCompanySlot(userId);
            } catch (err) {}
        }

        try {
            const [company, freelancer, inviter] = await Promise.all([
                companyRepository.findById(invitation.company_id),
                userRepository.findById(userId),
                invitation.invited_by ? userRepository.findById(invitation.invited_by) : null,
            ]);

            if (freelancer) {
                await emailService.sendInvitationAcceptedEmailToFreelancer(freelancer.email, {
                    companyName: company?.name || "the company",
                });
            }

            if (inviter) {
                await emailService.sendInvitationAcceptedEmailToInviter(inviter.email, {
                    freelancerName: freelancer?.name || "The freelancer",
                    companyName: company?.name || "your company",
                });
            }
        } catch (err) {}

        try {
            await auditLogRepository.create({
                userId,
                companyId: invitation.company_id,
                action: "freelancer_access_granted",
                module: "Freelancer",
                status: "SUCCESS",
                description: `Invitation accepted (#${invitation.id})`,
            });
        } catch (logErr) {}
    }

    // Case A/B from the invitation link: requires the caller to already be
    // authenticated as the invited email (frontend routes a not-logged-in
    // visitor through signup/login first, preserving the token).
    async acceptInvitationByToken(token, userId, userEmail) {
        const tokenHash = hashInviteToken(token);
        const invitation = await companyInvitationRepository.findByTokenHash(tokenHash);

        if (!invitation) {
            throw new Error("This invitation is no longer valid.");
        }

        if (invitation.invited_email !== (userEmail || "").trim().toLowerCase()) {
            throw new Error("This invitation was sent to another email address. Please log in with the invited email address to accept this invitation.");
        }

        await this._finalizeAcceptance(invitation, userId);
    }

    // Case C: a logged-in Freelancer accepting from their own pending-
    // invitations list, with no raw token in hand — safe because the
    // authenticated session itself is the proof of email ownership here.
    async acceptInvitationInApp(invitationId, userId, userEmail) {
        const invitation = await companyInvitationRepository.findById(invitationId);

        if (!invitation || invitation.effective_status !== "PENDING") {
            throw new Error("This invitation is no longer valid.");
        }

        if (invitation.invited_email !== (userEmail || "").trim().toLowerCase()) {
            throw new Error("This invitation was sent to another email address.");
        }

        await this._finalizeAcceptance(invitation, userId);
    }

    async declineInvitationInApp(invitationId, userId, userEmail) {
        const invitation = await companyInvitationRepository.findById(invitationId);

        if (!invitation || invitation.effective_status !== "PENDING") {
            throw new Error("This invitation is no longer valid.");
        }

        if (invitation.invited_email !== (userEmail || "").trim().toLowerCase()) {
            throw new Error("This invitation was sent to another email address.");
        }

        await companyInvitationRepository.markRevoked(invitationId);
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
