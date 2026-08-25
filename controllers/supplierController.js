const supplierService = require("../services/supplierService");

class SupplierController {

    async create(req, res) {

        try {

            const supplier = await supplierService.create(req.user.id, req.body);

            res.status(201).json({
                success: true,
                supplier
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

            const suppliers = await supplierService.getAll(req.user.id);

            res.json({
                success: true,
                suppliers
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

            const supplier = await supplierService.update(
                req.params.id,
                req.user.id,
                req.body
            );

            res.json({
                success: true,
                supplier
            });

        } catch (err) {

            let status = 500;
            if (err.message === "Supplier not found.") status = 404;
            else if (err.message.includes("already exists")) status = 400;

            res.status(status).json({
                success: false,
                error: err.message
            });

        }

    }

    async get(req, res) {

        try {

            const supplier = await supplierService.get(
                req.params.id,
                req.user.id
            );

            res.json({
                success: true,
                supplier
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

            const supplier = await supplierService.updateStatus(
                req.params.id,
                req.user.id,
                status
            );

            res.json({
                success: true,
                supplier
            });

        } catch (err) {

            const status = err.message === "Supplier not found." ? 404 : 400;

            res.status(status).json({
                success: false,
                error: err.message
            });

        }

    }

    async delete(req, res) {

        try {

            await supplierService.delete(req.params.id, req.user.id);

            res.json({
                success: true,
                message: "Supplier deleted."
            });

        } catch (err) {

            const status = err.message === "Supplier not found." ? 404 : 500;

            res.status(status).json({
                success: false,
                error: err.message
            });

        }

    }

}

module.exports = new SupplierController();
