const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const {
  handleValidationErrors,
} = require("../middleware/validationMiddleware"); // <-- IMPORT
const {
  validateRegister,
  validateLogin,
  validateRequestPasswordReset,
  validateResetPassword,
} = require("../controllers/authController");
const { auth } = require("../middleware/authMiddleware");
const passport = require("passport");

// ... (Social login routes remain the same)

router.post(
  "/register",
  validateRegister,
  handleValidationErrors,
  authController.register
);
router.post(
  "/login",
  validateLogin,
  handleValidationErrors,
  authController.login
);
router.post("/logout", auth, authController.logout); // No validation here
router.post("/refresh-token", authController.refreshToken); // No validation here

router.post(
  "/request-password-reset",
  validateRequestPasswordReset,
  handleValidationErrors,
  authController.requestPasswordReset
);
router.post(
  "/reset-password/:token",
  validateResetPassword,
  handleValidationErrors,
  authController.resetPassword
);

module.exports = router;
// This code defines the authentication routes for user registration, login, password reset, and social logins in an Express application.