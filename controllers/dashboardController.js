const dashboardService = require("../services/dashboardService");
const { isValidInvoiceDocumentType } = require("../utils/documentTypes");

function clientIdFrom(req) {
    return req.query.client_id ? Number(req.query.client_id) : null;
}

function documentTypeFrom(req) {
    return req.query.document_type || null;
}

class DashboardController {

    async getSummary(req, res) {
        try {
            const documentType = documentTypeFrom(req);

            if (documentType && !isValidInvoiceDocumentType(documentType)) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid document type.",
                });
            }

            const summary = await dashboardService.getSummary(
                req.company.id,
                clientIdFrom(req),
                documentType
            );
            res.json({ success: true, summary });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async getMonthly(req, res) {
        try {
            const monthly = await dashboardService.getMonthly(req.company.id, clientIdFrom(req));
            res.json({ success: true, monthly });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async getTopClients(req, res) {
        try {
            const topClients = await dashboardService.getTopClients(req.company.id);
            res.json({ success: true, topClients });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async getConfidenceDistribution(req, res) {
        try {
            const distribution = await dashboardService.getConfidenceDistribution(
                req.company.id,
                clientIdFrom(req)
            );
            res.json({ success: true, distribution });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async getQuality(req, res) {
        try {
            const quality = await dashboardService.getQuality(req.company.id, clientIdFrom(req));
            res.json({ success: true, ...quality });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async getClientAnalytics(req, res) {
        try {
            const clients = await dashboardService.getClientAnalytics(req.company.id);
            res.json({ success: true, clients });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async getActivity(req, res) {
        try {
            const activity = await dashboardService.getActivity(req.company.id);
            res.json({ success: true, activity });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }

    async getDocumentTypeCounts(req, res) {
        try {
            const counts = await dashboardService.getDocumentTypeCounts(
                req.company.id,
                clientIdFrom(req)
            );
            res.json({ success: true, counts });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
}

module.exports = new DashboardController();
