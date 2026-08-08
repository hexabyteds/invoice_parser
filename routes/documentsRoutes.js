const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const documentsController = require("../controllers/documentsController");

router.use(authMiddleware);

router.get("/", (req, res) =>
    documentsController.list(req, res)
);

module.exports = router;
