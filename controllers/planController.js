const planService = require("../services/planService");

class PlanController {

  async getPlans(req, res) {
    try {

      const plans = await planService.getPlans();

      res.json({
        success: true,
        plans
      });

    } catch (err) {

      res.status(500).json({
        success: false,
        error: err.message
      });

    }
  }
  async getActivePlans(req, res) {

    try {

        const plans = await planService.getActivePlans();

        res.json({
            success: true,
            plans
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

}

  async getPlan(req, res) {
    try {

      const plan = await planService.getPlan(req.params.id);

      res.json({
        success: true,
        plan
      });

    } catch (err) {

      const status =
        err.message === "Plan not found."
          ? 404
          : 500;

      res.status(status).json({
        success: false,
        error: err.message
      });

    }
  }

  async createPlan(req, res) {
    try {

      const plan = await planService.createPlan(req.body);

      res.status(201).json({
        success: true,
        message: "Plan created successfully.",
        plan
      });

    } catch (err) {

      const status =
        err.message === "Plan slug already exists."
          ? 409
          : 500;

      res.status(status).json({
        success: false,
        error: err.message
      });

    }
  }

  async updatePlan(req, res) {
    try {

      const plan = await planService.updatePlan(
        req.params.id,
        req.body
      );

      res.json({
        success: true,
        message: "Plan updated successfully.",
        plan
      });

    } catch (err) {

      let status = 500;

      if (err.message === "Plan not found.") {
        status = 404;
      }

      if (err.message === "Plan slug already exists.") {
        status = 409;
      }

      res.status(status).json({
        success: false,
        error: err.message
      });

    }
  }

  async changeStatus(req, res) {
    try {

      const message = await planService.changeStatus(
        req.params.id,
        req.body.active
      );

      res.json({
        success: true,
        message
      });

    } catch (err) {

      let status = 500;

      if (err.message === "Plan not found.") {
        status = 404;
      }

      if (err.message === "Free plan cannot be disabled.") {
        status = 400;
      }

      res.status(status).json({
        success: false,
        error: err.message
      });

    }
  }

  async deletePlan(req, res) {
    try {

      const message = await planService.deletePlan(
        req.params.id
      );

      res.json({
        success: true,
        message
      });

    } catch (err) {

      let status = 500;

      if (err.message === "Plan not found.") {
        status = 404;
      }

      if (
        err.message === "Free plan cannot be deleted." ||
        err.message === "Plan is assigned to customers."
      ) {
        status = 400;
      }

      res.status(status).json({
        success: false,
        error: err.message
      });

    }
  }

}

module.exports = new PlanController();