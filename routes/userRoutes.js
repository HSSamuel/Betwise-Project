const express = require("express");
const router = express.Router();
const {
  getProfile,
  changeEmail,
  changePassword,
} = require("../controllers/userController");
const { auth } = require("../middleware/authMiddleware"); // Only auth, not isAdmin, for user's own actions
const {
  validateChangeEmail,
  validateChangePassword,
} = require("../controllers/userController");

// @route   GET /users/profile
// @desc    Get current logged-in user's profile
// @access  Private (Authenticated User)
router.get("/profile", auth, getProfile);

// @route   PATCH /users/email
// @desc    Change current logged-in user's email
// @access  Private (Authenticated User)
router.patch("/email", auth, validateChangeEmail, changeEmail);

// @route   PATCH /users/password
// @desc    Change current logged-in user's password
// @access  Private (Authenticated User)
router.patch("/password", auth, validateChangePassword, changePassword);

module.exports = router;
