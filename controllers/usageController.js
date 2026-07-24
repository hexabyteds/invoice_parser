const usageService = require("../services/usageService");
console.log("UsageService methods:", Object.keys(usageService));
console.log("getAllCustomersUsage:", typeof usageService.getAllCustomersUsage);
class UsageController {

    // Customer Usage
    async getMyUsage(req, res) {

        try {

            const usage = await usageService.getUsage(req.user.id);

            res.json({
                success: true,
                usage
            });

        } catch (err) {

            res.status(400).json({
                success: false,
                error: err.message
            });

        }

    }

    // Admin Usage Dashboard
    async getAllUsage(req, res) {

        try {

            const usage = await usageService.getAllCustomersUsage();

            console.log(JSON.stringify(usage, null, 2));
            res.json({
                success: true,
                usage
            });

        } catch (err) {

            res.status(400).json({
                success: false,
                error: err.message
            });

        }

    }

    async getAdminDashboard(req, res) {

        try {
    
            const dashboard =
                await usageService.getAdminDashboard();
    
            res.json({
                success: true,
                dashboard
            });
    
        } catch (err) {
    
            res.status(500).json({
                success: false,
                error: err.message
            });
    
        }
    
    }
 

}

module.exports = new UsageController();