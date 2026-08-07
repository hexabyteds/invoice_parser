const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const clientController = require("../controllers/clientController");

router.use(authMiddleware);

router.post("/", (req, res) =>
    clientController.create(req, res)
);

router.get("/", (req, res) =>
    clientController.getAll(req, res)
);

router.get("/:id", (req, res) =>
    clientController.get(req, res)
);

router.put("/:id", (req, res) =>
    clientController.update(req, res)
);

router.patch("/:id/status", (req, res) =>
    clientController.updateStatus(req, res)
);

router.delete("/:id", (req, res) =>
    clientController.delete(req, res)
);

module.exports = router;