// adminRoutes.js

const express = require("express");
const router = express.Router();
const { auth, isAdmin } = require("../middleware/authMiddleware");
const {
  getPlatformStats,
  getFinancialDashboard,
  listUsers,
  getAllUsersFullDetails,
  adminGetUserProfile,
  adminUpdateUserRole,
  adminAdjustUserWallet,
  adminDeleteUser,
  adminGetWithdrawals,
  adminProcessWithdrawal,
  validateListUsers,
  validateAdminUserAction,
  validateAdminUpdateRole,
  validateAdminAdjustWallet,
  validateProcessWithdrawal,
  getGameRiskAnalysis,
  getGameRiskSummary,
} = require("../controllers/adminController");
const { manualGameSync } = require("../controllers/adminController");
const { validateGameId } = require("../controllers/gameController");

// --- Admin Dashboard & Stats ---
router.get("/dashboard/financial", auth, isAdmin, getFinancialDashboard);
router.get("/stats/platform", auth, isAdmin, getPlatformStats);

// --- User Management by Admin ---
router.get("/users", auth, isAdmin, validateListUsers, listUsers);
router.get("/all-users-full", auth, isAdmin, getAllUsersFullDetails);

// @route   GET /admin/users/:id
// @desc    Admin: Get a single user's profile
// @access  Private (Admin)
router.get(
  "/users/:id",
  auth,
  isAdmin,
  validateAdminUserAction,
  adminGetUserProfile
);

// @route   PATCH /admin/users/:id/role
// @desc    Admin: Update a user's role
// @access  Private (Admin)
router.patch(
  "/users/:id/role",
  auth,
  isAdmin,
  validateAdminUpdateRole,
  adminUpdateUserRole
);

// @route   PATCH /admin/users/:id/wallet
// @desc    Admin: Manually adjust a user's wallet balance
// @access  Private (Admin)
router.patch(
  "/users/:id/wallet",
  auth,
  isAdmin,
  validateAdminAdjustWallet,
  adminAdjustUserWallet
);

// @route   DELETE /admin/users/:id
// @desc    Admin: Delete a user
// @access  Private (Admin)
router.delete(
  "/users/:id",
  auth,
  isAdmin,
  validateAdminUserAction,
  adminDeleteUser
);

// --- Withdrawal Management by Admin ---

// @route   GET /admin/withdrawals
// @desc    Admin: Get all withdrawal requests (defaults to pending)
// @access  Private (Admin)
router.get("/withdrawals", auth, isAdmin, adminGetWithdrawals);

// @route   PATCH /admin/withdrawals/:id/process
// @desc    Admin: Approve or reject a withdrawal request
// @access  Private (Admin)
router.patch(
  "/withdrawals/:id/process",
  auth,
  isAdmin,
  validateProcessWithdrawal,
  adminProcessWithdrawal
);

router.post("/games/sync", auth, isAdmin, manualGameSync);

// @route   GET /admin/games/:id/risk
// @desc    Admin: Get a risk analysis for a specific game
// @access  Private (Admin)
router.get(
  "/games/:id/risk",
  auth,
  isAdmin,
  validateGameId,
  getGameRiskAnalysis
);

// @route   GET /admin/games/:id/risk-summary
// @desc    Admin: Get an AI-powered risk summary for a specific game
// @access  Private (Admin)
router.get(
  "/games/:id/risk-summary",
  auth,
  isAdmin,
  validateGameId,
  getGameRiskSummary
);

module.exports = router;
// This code defines the routes for admin functionalities in an Express application.
