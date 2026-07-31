import api from "./api";

const subscriptionApi = {
  getCurrent: () => api.get("/subscriptions/current"),
  selectPlan: (planId, billingCycle = "monthly") =>
    api.post("/subscriptions/select-plan", { planId, billingCycle }),
  cancel: () => api.post("/subscriptions/cancel"),
};

export default subscriptionApi;
