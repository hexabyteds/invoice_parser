const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyContext = require("../middleware/companyContext");
const requireCompanyPermission = require("../middleware/requireCompanyPermission");
const bankStatementController = require("../controllers/bankStatementController");

router.use(authMiddleware);
router.use(companyContext);

router.get("/:id", requireCompanyPermission("bank_statements", "view"), (req, res) =>
    bankStatementController.get(req, res)
);

router.get("/:id/source", requireCompanyPermission("bank_statements", "view"), (req, res) =>
    bankStatementController.getSource(req, res)
);

router.get("/:id/transactions", requireCompanyPermission("bank_statements", "view"), (req, res) =>
    bankStatementController.getTransactions(req, res)
);

router.put("/:id", requireCompanyPermission("bank_statements", "edit"), (req, res) =>
    bankStatementController.update(req, res)
);

router.delete("/:id", requireCompanyPermission("bank_statements", "delete"), (req, res) =>
    bankStatementController.delete(req, res)
);

module.exports = router;
