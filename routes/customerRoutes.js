const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyContext = require("../middleware/companyContext");
const requireCompanyPermission = require("../middleware/requireCompanyPermission");
const customerController = require("../controllers/customerController");

router.use(authMiddleware);
router.use(companyContext);

router.post("/", requireCompanyPermission("customers", "create"), (req, res) =>
    customerController.create(req, res)
);

router.get("/", requireCompanyPermission("customers", "view"), (req, res) =>
    customerController.getAll(req, res)
);

router.get("/:id", requireCompanyPermission("customers", "view"), (req, res) =>
    customerController.get(req, res)
);

router.put("/:id", requireCompanyPermission("customers", "edit"), (req, res) =>
    customerController.update(req, res)
);

router.patch("/:id/status", requireCompanyPermission("customers", "edit"), (req, res) =>
    customerController.updateStatus(req, res)
);

router.delete("/:id", requireCompanyPermission("customers", "delete"), (req, res) =>
    customerController.delete(req, res)
);

module.exports = router;
