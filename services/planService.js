const planRepository = require("../repositories/planRepository");

class PlanService {

  async getPlans() {
    return await planRepository.getAllPlans();
  }

  async getPlan(id) {

    const plan = await planRepository.getPlanById(id);

    if (!plan) {
      throw new Error("Plan not found.");
    }

    return plan;
  }
  async getActivePlans() {

    return await planRepository.getActivePlans();

}
  async createPlan(data) {

    const existing = await planRepository.getPlanBySlug(data.slug);

    if (existing) {
      throw new Error("Plan slug already exists.");
    }

    const id = await planRepository.createPlan(data);

    return await planRepository.getPlanById(id);
  }

  async updatePlan(id, data) {

    const plan = await planRepository.getPlanById(id);

    if (!plan) {
      throw new Error("Plan not found.");
    }

    const existing = await planRepository.getPlanBySlug(data.slug);

    if (existing && existing.id != id) {
      throw new Error("Plan slug already exists.");
    }

    await planRepository.updatePlan(id, data);

    return await planRepository.getPlanById(id);
  }

  async changeStatus(id, active) {

    const plan = await planRepository.getPlanById(id);

    if (!plan) {
      throw new Error("Plan not found.");
    }

    // Prevent disabling Free plan
    if (plan.slug === "free" && !active) {
      throw new Error("Free plan cannot be disabled.");
    }

    await planRepository.updateStatus(id, active);

    return "Plan updated successfully.";
  }

  async deletePlan(id) {

    const plan = await planRepository.getPlanById(id);

    if (!plan) {
      throw new Error("Plan not found.");
    }

    // Never delete Free plan
    if (plan.slug === "free") {
      throw new Error("Free plan cannot be deleted.");
    }

    // Check if customers are using this plan
    const inUse = await planRepository.isPlanInUse(id);

    if (inUse) {
      throw new Error("Plan is assigned to customers.");
    }

    await planRepository.deletePlan(id);

    return "Plan deleted successfully.";
  }

}

module.exports = new PlanService();