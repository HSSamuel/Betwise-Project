const express = require("express");
const router = express.Router();
const { auth, isAdmin } = require("../middleware/authMiddleware");
const {
  getPlatformStats,
  getFinancialDashboard,
  listUsers,
  getAllUsersFullDetails, // Import the new function
} = require("../controllers/adminController");
const gameController = require("../controllers/gameController"); // For game management routes under admin

// --- Admin Dashboard & Stats ---

// @route   GET /admin/dashboard
// @desc    Admin: Get financial dashboard (totals of topups, bets, wins, revenue)
// @access  Private (Admin)
router.get("/dashboard/financial", auth, isAdmin, getFinancialDashboard);

// @route   GET /admin/stats
// @desc    Admin: Get platform statistics (users, bets, games)
// @access  Private (Admin)
router.get("/stats/platform", auth, isAdmin, getPlatformStats);

// --- User Management by Admin ---

// @route   GET /admin/users
// @desc    Admin: List all users (with pagination and filtering)
// @access  Private (Admin)
router.get("/users", auth, isAdmin, listUsers);

// @route   GET /admin/all-users-full
// @desc    Admin: Get all users with full details (including password)
// @access  Private (Admin)
router.get("/all-users-full", auth, isAdmin, getAllUsersFullDetails);

// Future Admin User Management Routes:
// router.get("/users/:userId", auth, isAdmin, adminGetUserProfile);
// router.put("/users/:userId/role", auth, isAdmin, adminUpdateUserRole);
// router.put("/users/:userId/wallet", auth, isAdmin, adminAdjustUserWallet);
// router.delete("/users/:userId", auth, isAdmin, adminDeleteUser);

// --- Game Management by Admin (already in gameRoutes.js, but could be aliased or specific admin actions here) ---
// Example: if you want /admin/games routes specifically for admin game views or bulk actions
// router.get("/games", auth, isAdmin, gameController.getGames); // Admin view of games, potentially more details
// router.post("/games/bulk-update-odds", auth, isAdmin, adminBulkUpdateOdds);

module.exports = router;
