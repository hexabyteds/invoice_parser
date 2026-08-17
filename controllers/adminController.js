const adminService = require("../services/adminService");

const DEFAULT_CUSTOMER_LIMIT = 20;
const MAX_CUSTOMER_LIMIT = 100;

class AdminController {
  async getStats(req, res) {
    try {
      const data = await adminService.getDashboardStats();

      res.json({
        success: true,
        ...data,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }

  async getCustomers(req, res) {
    try {
      const limit =
        req.query.limit === undefined
          ? DEFAULT_CUSTOMER_LIMIT
          : Number(req.query.limit);
      const offset =
        req.query.offset === undefined ? 0 : Number(req.query.offset);

      if (
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > MAX_CUSTOMER_LIMIT
      ) {
        return res.status(400).json({
          success: false,
          error: `limit must be an integer between 1 and ${MAX_CUSTOMER_LIMIT}`,
        });
      }

      if (!Number.isSafeInteger(offset) || offset < 0) {
        return res.status(400).json({
          success: false,
          error: "offset must be a non-negative integer",
        });
      }

      const { customers, total } = await adminService.getCustomers({
        limit,
        offset,
      });

      res.json({
        success: true,
        customers,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + customers.length < total,
        },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }

  async getCustomerById(req, res) {
    try {
      const data = await adminService.getCustomerDetails(req.params.id);

      res.json({
        success: true,
        ...data,
      });
    } catch (err) {
      const status = err.message === "Customer not found." ? 404 : 500;

      res.status(status).json({
        success: false,
        error: err.message,
      });
    }
  }


  async getCustomerLoginHistory(req, res) {
    try {
      const history = await adminService.getCustomerLoginHistory(req.params.id);

      res.json({
        success: true,
        history,
      });
    } catch (err) {
      const status = err.message === "Customer not found." ? 404 : 500;

      res.status(status).json({
        success: false,
        error: err.message,
      });
    }
  }

  async updateCustomer(req, res) {
    try {
      const customer = await adminService.updateCustomer(
        req.params.id,
        req.body
      );

      res.json({
        success: true,
        customer,
        message: "Customer updated successfully.",
      });

    } catch (err) {
      const status =
        err.message === "Customer not found."
          ? 404
          : err.message.includes("required") ||
              err.message.includes("Invalid") ||
              err.message.includes("Email already")
            ? 400
            : 500;

      res.status(status).json({
        success: false,
        error: err.message,
      });
    }
  }

  async updateCustomerStatus(req, res) {
    try {
      const result = await adminService.updateCustomerStatus(
        req.params.id,
        req.body.status
      );

      res.json({
        success: true,
        message: result,
      });
    } catch (err) {
      const status = err.message === "Customer not found." ? 404 : 400;

      res.status(status).json({
        success: false,
        error: err.message,
      });
    }
  }

  async updateCustomerPlan(req, res) {
     

    try {
      const subscription =
      await adminService.updateCustomerPlan(
          req.params.id,
          req.body.planId,
          req.body.billingCycle || "monthly"
      );
  
  res.json({
      success: true,
      message: "Subscription updated successfully.",
      subscription
  });
    } catch (err) {
      const status = err.message === "Customer not found." ? 404 : 400;

      res.status(status).json({
        success: false,
        error: err.message,
      });
    }
  }
  async resetCustomerPassword(req, res) {
    try {
      const result = await adminService.resetCustomerPassword(
        req.params.id,
        req.body.password
      );

      res.json({
        success: true,
        message: result,
      });
    } catch (err) {
      const status = err.message === "Customer not found." ? 404 : 400;

      res.status(status).json({
        success: false,
        error: err.message,
      });
    }
  }

  async deleteCustomer(req, res) {
    try {
      const result = await adminService.deleteCustomer(req.params.id);

      res.json({
        success: true,
        message: result,
      });
    } catch (err) {
      const status = err.message === "Customer not found." ? 404 : 500;

      res.status(status).json({
        success: false,
        error: err.message,
      });
    }
  }

  async getSubscriptions(req, res) {
    try {
      const subscriptions = await adminService.getSubscriptions();

      res.json({
        success: true,
        subscriptions,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
}

module.exports = new AdminController();
