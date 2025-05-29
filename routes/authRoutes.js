const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// @route   POST /auth/register
// @desc    Register a new user
// @access  Public
router.post("/register", authController.register);

// @route   POST /auth/login
// @desc    Authenticate user and get tokens
// @access  Public
router.post("/login", authController.login);

// @route   POST /auth/refresh-token
// @desc    Refresh access token using a refresh token
// @access  Public (requires a valid refresh token in the body)
router.post("/refresh-token", authController.refreshToken);

// @route   POST /auth/request-password-reset
// @desc    Request a password reset link
// @access  Public
router.post("/request-password-reset", authController.requestPasswordReset);

// @route   POST /auth/forgot-password
// @desc    Alias for Request a password reset link
// @access  Public
router.post("/forgot-password", authController.requestPasswordReset); // Points to the same controller

// @route   POST /auth/reset-password/:token
// @desc    Reset password using a token
// @access  Public
router.post("/reset-password/:token", authController.resetPassword);

module.exports = router;
