const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const customerController = require("../controllers/customerController");

router.use(authMiddleware);

router.post("/", (req, res) =>
    customerController.create(req, res)
);

router.get("/", (req, res) =>
    customerController.getAll(req, res)
);

router.get("/:id", (req, res) =>
    customerController.get(req, res)
);

router.put("/:id", (req, res) =>
    customerController.update(req, res)
);

router.patch("/:id/status", (req, res) =>
    customerController.updateStatus(req, res)
);

router.delete("/:id", (req, res) =>
    customerController.delete(req, res)
);

module.exports = router;
