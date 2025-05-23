const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { auth, isAdmin } = require("../middleware/authMiddleware");

// Protected user route
router.get("/profile", auth, (req, res) => {
  res.json({ user: req.user });
});

// Change email
router.patch("/email", auth, userController.changeEmail);

// Change password
router.patch("/password", auth, userController.changePassword);

module.exports = router;
