import api from "./api";

const companyApi = {
  acceptInvitation: (membershipId) =>
    api.post(`/companies/invitations/${membershipId}/accept`),
  declineInvitation: (membershipId) =>
    api.post(`/companies/invitations/${membershipId}/decline`),

  inviteFreelancer: (email, permissions) =>
    api.post("/companies/team/invite", { email, permissions }),
  listTeam: () => api.get("/companies/team"),
  updateMember: (membershipId, data) =>
    api.patch(`/companies/team/${membershipId}`, data),
  removeMember: (membershipId) =>
    api.delete(`/companies/team/${membershipId}`),
};

export default companyApi;
