const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const bankStatementController = require("../controllers/bankStatementController");

router.use(authMiddleware);

router.get("/:id", (req, res) =>
    bankStatementController.get(req, res)
);

router.get("/:id/source", (req, res) =>
    bankStatementController.getSource(req, res)
);

router.get("/:id/transactions", (req, res) =>
    bankStatementController.getTransactions(req, res)
);

router.put("/:id", (req, res) =>
    bankStatementController.update(req, res)
);

router.delete("/:id", (req, res) =>
    bankStatementController.delete(req, res)
);

module.exports = router;
