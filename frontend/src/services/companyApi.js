import api from "./api";

const companyApi = {
  createCompany: (data) => api.post("/companies", data),
  getCurrentCompany: () => api.get("/companies/current"),
  updateCurrentCompany: (data) => api.patch("/companies/current", data),

  // In-app accept/decline (Case C: a logged-in Freelancer acting on their
  // own pending-invitations list — see NoCompanyState.jsx). `id` here is
  // an invitation id, not a membership id.
  acceptInvitation: (id) =>
    api.post(`/companies/invitations/${id}/accept`),
  declineInvitation: (id) =>
    api.post(`/companies/invitations/${id}/decline`),

  inviteFreelancer: (email, permissions) =>
    api.post("/companies/team/invite", { email, permissions }),
  listTeam: () => api.get("/companies/team"),
  listInvitations: () => api.get("/companies/team/invitations"),
  resendInvitation: (invitationId) =>
    api.post(`/companies/team/invitations/${invitationId}/resend`),
  revokeInvitation: (invitationId) =>
    api.post(`/companies/team/invitations/${invitationId}/revoke`),
  updateMember: (membershipId, data) =>
    api.patch(`/companies/team/${membershipId}`, data),
  removeMember: (membershipId) =>
    api.delete(`/companies/team/${membershipId}`),

  // The emailed-link side of the flow (Case A/B) — public preview, then an
  // authenticated accept once the visitor is logged in as the invited
  // email. Mounted at /api/invitations, not /api/companies (see
  // routes/invitationRoutes.js — it can't sit behind the same
  // blanket-authMiddleware router).
  getInvitationByToken: (token) =>
    api.get(`/invitations/token/${token}`),
  acceptInvitationByToken: (token) =>
    api.post(`/invitations/token/${token}/accept`),
};

export default companyApi;
