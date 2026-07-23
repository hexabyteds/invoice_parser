const clientService = require("../services/clientService");

class ClientController {

    async create(req, res) {

        try {
            console.log("req.body", req.body);
            console.log("req.user.id", req.user.id);

            const client = await clientService.create(req.user.id, req.body);

            res.status(201).json({
                success: true,
                client
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

            const clients = await clientService.getAll(req.user.id);

            res.json({
                success: true,
                clients
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

            const client = await clientService.update(
                req.params.id,
                req.body
            );

            res.json({
                success: true,
                client
            });

        } catch (err) {

            res.status(500).json({
                success: false,
                error: err.message
            });

        }

    }

    async get(req, res) {

        try {
    
            const client = await clientService.get(
                req.params.id,
                req.user.id
            );
    
            res.json({
                success: true,
                client
            });
    
        } catch (err) {
    
            res.status(404).json({
                success: false,
                error: err.message
            });
    
        }
    
    }
    
    async delete(req, res) {

        try {

            await clientService.delete(req.params.id, req.user.id);

            res.json({
                success: true,
                message: "Client deleted."
            });

        } catch (err) {

            res.status(500).json({
                success: false,
                error: err.message
            });

        }

    }

}

module.exports = new ClientController();