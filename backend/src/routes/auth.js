
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authcontroller");
const authMiddleware = require("../middleware/auth");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/users", authMiddleware, authController.listUsers);

module.exports = router;
