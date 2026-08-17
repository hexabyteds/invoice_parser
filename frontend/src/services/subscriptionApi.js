import api from "./api";

const subscriptionApi = {
  getCurrent: () => api.get("/subscriptions/current"),
  selectPlan: (planId, billingCycle = "monthly") =>
    api.post("/subscriptions/select-plan", { planId, billingCycle }),
  cancel: () => api.post("/subscriptions/cancel"),
  resume: () => api.post("/subscriptions/renew"),
  createCheckoutSession: (planId, interval = "monthly") =>
    api.post("/subscriptions/checkout", { planId, interval }),
  createPortalSession: () => api.post("/subscriptions/portal"),
  getPayments: (params) => api.get("/subscriptions/payments", { params }),
  getPaymentDetail: (invoiceId) =>
    api.get(`/subscriptions/payments/${invoiceId}`),
};

export default subscriptionApi;
