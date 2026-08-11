import api from "./api";

const subscriptionApi = {
  getCurrent: () => api.get("/subscriptions/current"),
  selectPlan: (planId, billingCycle = "monthly") =>
    api.post("/subscriptions/select-plan", { planId, billingCycle }),
  cancel: () => api.post("/subscriptions/cancel"),
  createCheckoutSession: (planId, interval = "monthly") =>
    api.post("/subscriptions/checkout", { planId, interval }),
  createPortalSession: () => api.post("/subscriptions/portal"),
};

export default subscriptionApi;
