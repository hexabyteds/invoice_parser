const customerService = require("../services/customerService");

class CustomerController {

    async create(req, res) {

        try {

            const customer = await customerService.create(req.company.id, req.user.id, req.body);

            res.status(201).json({
                success: true,
                customer
            });

        } catch (err) {

            res.status(400).json({
                success: false,
                error: err.message
            });

        }

    }

    async getAll(req, res) {

        try {

            const customers = await customerService.getAll(req.company.id);

            res.json({
                success: true,
                customers
            });

        } catch (err) {

            res.status(500).json({
                success: false,
                error: err.message
            });

        }

    }

    async update(req, res) {

        try {

            const customer = await customerService.update(
                req.params.id,
                req.company.id,
                req.body,
                req.user.id
            );

            res.json({
                success: true,
                customer
            });

        } catch (err) {

            let status = 500;
            if (err.message === "Customer not found.") status = 404;
            else if (err.message.includes("already exists")) status = 400;

            res.status(status).json({
                success: false,
                error: err.message
            });

        }

    }

    async get(req, res) {

        try {

            const customer = await customerService.get(
                req.params.id,
                req.company.id
            );

            res.json({
                success: true,
                customer
            });

        } catch (err) {

            res.status(404).json({
                success: false,
                error: err.message
            });

        }

    }

    async updateStatus(req, res) {

        try {

            const { status } = req.body;

            if (!["ACTIVE", "INACTIVE"].includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: "Status must be ACTIVE or INACTIVE."
                });
            }

            const customer = await customerService.updateStatus(
                req.params.id,
                req.company.id,
                status
            );

            res.json({
                success: true,
                customer
            });

        } catch (err) {

            const status = err.message === "Customer not found." ? 404 : 400;

            res.status(status).json({
                success: false,
                error: err.message
            });

        }

    }

    async delete(req, res) {

        try {

            await customerService.delete(req.params.id, req.company.id, req.user.id);

            res.json({
                success: true,
                message: "Customer deleted."
            });

        } catch (err) {

            // Mirrors update()/updateStatus() above — a not-found/not-owned
            // customer is a 404, not a genuine server failure.
            const status = err.message === "Customer not found." ? 404 : 500;

            res.status(status).json({
                success: false,
                error: err.message
            });

        }

    }

}

module.exports = new CustomerController();
