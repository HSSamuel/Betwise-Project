const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const {
  validateRegister,
  validateLogin,
  validateRequestPasswordReset,
  validateResetPassword,
} = require("../controllers/authController");
const { auth } = require("../middleware/authMiddleware");
const passport = require("passport");

// --- Social Login (OAuth) Routes ---

// @route   GET /auth/google
// @desc    Initiate Google OAuth login
// @access  Public
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

// @route   GET /auth/google/callback
// @desc    Google OAuth callback URL
// @access  Public
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/auth/login-failed",
    session: false,
  }),
  authController.socialLoginCallback
);

// @route   GET /auth/facebook
// @desc    Initiate Facebook OAuth login
// @access  Public
router.get(
  "/facebook",
  passport.authenticate("facebook", {
    scope: ["public_profile", "email"],
    session: false,
  })
);

// @route   GET /auth/facebook/callback
// @desc    Facebook OAuth callback URL
// @access  Public
router.get(
  "/facebook/callback",
  passport.authenticate("facebook", {
    failureRedirect: "/auth/login-failed",
    session: false,
  }),
  authController.socialLoginCallback
);

// Optional: A route for social login failures
router.get("/login-failed", (req, res) => {
  res.status(401).json({ msg: "Social media authentication failed." });
});

// --- Standard Authentication Routes ---

// @route   POST /auth/register
// @desc    Register a new user
// @access  Public
router.post("/register", validateRegister, authController.register);

// @route   POST /auth/login
// @desc    Authenticate user and get tokens
// @access  Public
router.post("/login", validateLogin, authController.login);

// @route   POST /auth/logout
// @desc    Logout user by blacklisting their token
// @access  Private (Authenticated User)
router.post("/logout", auth, authController.logout);

// @route   POST /auth/refresh-token
// @desc    Refresh access token using a refresh token
// @access  Public (requires a valid refresh token in the body)
router.post("/refresh-token", authController.refreshToken); // CORRECTED

// --- Password Management Routes ---

// @route   POST /auth/request-password-reset
// @desc    Request a password reset link
// @access  Public
router.post(
  "/request-password-reset",
  validateRequestPasswordReset,
  authController.requestPasswordReset
);

// @route   POST /auth/forgot-password
// @desc    Alias for requesting a password reset link
// @access  Public
router.post(
  "/forgot-password",
  validateRequestPasswordReset,
  authController.requestPasswordReset
);

// @route   POST /auth/reset-password/:token
// @desc    Reset password using a token
// @access  Public
router.post(
  "/reset-password/:token",
  validateResetPassword,
  authController.resetPassword
);

module.exports = router;
// This file defines the authentication routes for the application, including OAuth login, standard authentication, and password management.