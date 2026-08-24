const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const companyContext = require("../middleware/companyContext");
const requireCompanyPermission = require("../middleware/requireCompanyPermission");
const clientController = require("../controllers/clientController");

router.use(authMiddleware);
router.use(companyContext);

router.post("/", requireCompanyPermission("clients", "create"), (req, res) =>
    clientController.create(req, res)
);

router.get("/", requireCompanyPermission("clients", "view"), (req, res) =>
    clientController.getAll(req, res)
);

router.get("/:id", requireCompanyPermission("clients", "view"), (req, res) =>
    clientController.get(req, res)
);

router.put("/:id", requireCompanyPermission("clients", "edit"), (req, res) =>
    clientController.update(req, res)
);

router.patch("/:id/status", requireCompanyPermission("clients", "edit"), (req, res) =>
    clientController.updateStatus(req, res)
);

router.delete("/:id", requireCompanyPermission("clients", "delete"), (req, res) =>
    clientController.delete(req, res)
);

module.exports = router;
