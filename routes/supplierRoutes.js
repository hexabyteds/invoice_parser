const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyContext = require("../middleware/companyContext");
const requireCompanyPermission = require("../middleware/requireCompanyPermission");
const supplierController = require("../controllers/supplierController");

router.use(authMiddleware);
router.use(companyContext);

router.post("/", requireCompanyPermission("suppliers", "create"), (req, res) =>
    supplierController.create(req, res)
);

router.get("/", requireCompanyPermission("suppliers", "view"), (req, res) =>
    supplierController.getAll(req, res)
);

router.get("/:id", requireCompanyPermission("suppliers", "view"), (req, res) =>
    supplierController.get(req, res)
);

router.put("/:id", requireCompanyPermission("suppliers", "edit"), (req, res) =>
    supplierController.update(req, res)
);

router.patch("/:id/status", requireCompanyPermission("suppliers", "edit"), (req, res) =>
    supplierController.updateStatus(req, res)
);

router.delete("/:id", requireCompanyPermission("suppliers", "delete"), (req, res) =>
    supplierController.delete(req, res)
);

module.exports = router;
