const dashboardRepository = require("../repositories/dashboardRepository");

function calcDelta(current, previous) {
    current = Number(current) || 0;
    previous = Number(previous) || 0;

    if (!previous) {
        return { percent: current > 0 ? 100 : 0, trend: current > 0 ? "up" : "flat" };
    }

    const percent = Math.round(((current - previous) / previous) * 100);
    return { percent, trend: percent > 0 ? "up" : percent < 0 ? "down" : "flat" };
}

class DashboardService {

    async getSummary(userId, clientId = null, documentType = null) {

        const s = await dashboardRepository.getSummary(userId, clientId, documentType);

        const summary = {
            totalInvoices: {
                value: Number(s.totalInvoices),
                ...calcDelta(s.monthlyInvoices, s.prevMonthInvoices),
            },
            totalExpenses: {
                value: Number(s.totalExpenses),
                ...calcDelta(s.monthlyExpenses, s.prevMonthExpenses),
            },
            totalVAT: {
                value: Number(s.totalVAT),
                ...calcDelta(s.monthlyVAT, s.prevMonthVAT),
            },
            thisMonth: {
                value: Number(s.monthlyInvoices),
                ...calcDelta(s.monthlyInvoices, s.prevMonthInvoices),
            },
            avgInvoiceValue: {
                value: Number(s.avgInvoiceValue),
                ...calcDelta(s.monthlyAvgInvoiceValue, s.prevMonthAvgInvoiceValue),
            },
        };

        // Meaningless when already scoped to one client — omit rather than
        // report a constant "1".
        if (s.totalClients !== null) {
            summary.totalClients = {
                value: Number(s.totalClients),
                ...calcDelta(s.monthlyClients, s.prevMonthClients),
            };
        }

        return summary;
    }

    async getMonthly(userId, clientId = null) {
        return await dashboardRepository.getMonthly(userId, 12, clientId);
    }

    async getTopClients(userId) {
        return await dashboardRepository.getTopClients(userId, 10);
    }

    async getConfidenceDistribution(userId, clientId = null) {
        return await dashboardRepository.getConfidenceDistribution(userId, clientId);
    }

    async getQuality(userId, clientId = null) {
        return await dashboardRepository.getQuality(userId, clientId);
    }

    async getClientAnalytics(userId) {
        return await dashboardRepository.getClientAnalytics(userId);
    }

    async getActivity(userId) {
        return await dashboardRepository.getActivity(userId, 15);
    }

    async getDocumentTypeCounts(userId, clientId = null) {
        return await dashboardRepository.getDocumentTypeCounts(userId, clientId);
    }
}

module.exports = new DashboardService();
