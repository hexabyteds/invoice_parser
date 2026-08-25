const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const supplierController = require("../controllers/supplierController");

router.use(authMiddleware);

router.post("/", (req, res) =>
    supplierController.create(req, res)
);

router.get("/", (req, res) =>
    supplierController.getAll(req, res)
);

router.get("/:id", (req, res) =>
    supplierController.get(req, res)
);

router.put("/:id", (req, res) =>
    supplierController.update(req, res)
);

router.patch("/:id/status", (req, res) =>
    supplierController.updateStatus(req, res)
);

router.delete("/:id", (req, res) =>
    supplierController.delete(req, res)
);

module.exports = router;
