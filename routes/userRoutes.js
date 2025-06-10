const express = require("express");
const router = express.Router();
const {
  getProfile,
  changeEmail,
  changePassword,
  setPassword,
  validateChangeEmail,
  validateChangePassword,
  validateSetPassword,
  setBettingLimits,
  validateSetLimits,
} = require("../controllers/userController");
const { auth } = require("../middleware/authMiddleware");

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

// --- NEW ROUTE ---
// @route   POST /users/set-password
// @desc    Allows a logged-in user to set a password for the first time (e.g., after social login)
// @access  Private (Authenticated User)
router.post("/set-password", auth, validateSetPassword, setPassword);

// @route   POST /users/limits
// @desc    Set or update the user's weekly betting limits
// @access  Private (Authenticated User)
router.post("/limits", auth, validateSetLimits, setBettingLimits);

module.exports = router;
// This code defines the user-related routes for the application.
