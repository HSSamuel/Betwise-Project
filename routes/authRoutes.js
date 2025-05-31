const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const {
  validateRegister,
  validateLogin,
  validateRequestPasswordReset,
  validateResetPassword,
} = require("../controllers/authController");

// @route   POST /auth/register
// @desc    Register a new user
// @access  Public
router.post("/register", validateRegister, authController.register);

// @route   POST /auth/login
// @desc    Authenticate user and get tokens
// @access  Public
router.post("/login", validateLogin, authController.login);

// @route   POST /auth/refresh-token
// @desc    Refresh access token using a refresh token
// @access  Public (requires a valid refresh token in the body)
router.post(
  "/request-password-reset",
  validateRequestPasswordReset,
  authController.requestPasswordReset
);

// @route   POST /auth/request-password-reset
// @desc    Request a password reset link
// @access  Public
router.post("/request-password-reset", authController.requestPasswordReset);

// @route   POST /auth/forgot-password
// @desc    Alias for Request a password reset link
// @access  Public
router.post(
  "/forgot-password",
  validateRequestPasswordReset,
  authController.requestPasswordReset
); // Also apply here

// @route   POST /auth/reset-password/:token
// @desc    Reset password using a token
// @access  Public
router.post(
  "/reset-password/:token",
  validateResetPassword,
  authController.resetPassword
);

module.exports = router;
