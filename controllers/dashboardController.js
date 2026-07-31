const dashboardService = require("../services/dashboardService");

function clientIdFrom(req) {
    return req.query.client_id ? Number(req.query.client_id) : null;
}

class DashboardController {

    async getSummary(req, res) {
        try {
            const summary = await dashboardService.getSummary(req.user.id, clientIdFrom(req));
            res.json({ success: true, summary });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async getMonthly(req, res) {
        try {
            const monthly = await dashboardService.getMonthly(req.user.id, clientIdFrom(req));
            res.json({ success: true, monthly });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async getTopClients(req, res) {
        try {
            const topClients = await dashboardService.getTopClients(req.user.id);
            res.json({ success: true, topClients });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async getConfidenceDistribution(req, res) {
        try {
            const distribution = await dashboardService.getConfidenceDistribution(
                req.user.id,
                clientIdFrom(req)
            );
            res.json({ success: true, distribution });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async getQuality(req, res) {
        try {
            const quality = await dashboardService.getQuality(req.user.id, clientIdFrom(req));
            res.json({ success: true, ...quality });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async getClientAnalytics(req, res) {
        try {
            const clients = await dashboardService.getClientAnalytics(req.user.id);
            res.json({ success: true, clients });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async getActivity(req, res) {
        try {
            const activity = await dashboardService.getActivity(req.user.id);
            res.json({ success: true, activity });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
}

module.exports = new DashboardController();
