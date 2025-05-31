const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/authMiddleware");
const {
  getWallet,
  topUpWallet,
  getTransactionHistory,
  getWalletSummary,
} = require("../controllers/walletController");
const {
  validateTopUpWallet,
  validateGetTransactionHistory,
} = require("../controllers/walletController");

// @route   GET /wallet
// @desc    Get current user's wallet balance and basic info
// @access  Private (Authenticated User)
router.get("/", auth, getWallet);

// @route   POST /wallet/topup
// @desc    Top up current user's wallet
// @access  Private (Authenticated User)
router.post("/topup", auth, validateTopUpWallet, topUpWallet);

// @route   GET /wallet/transactions
// @desc    Get transaction history for the current user (paginated, filterable)
// @access  Private (Authenticated User)
router.get(
  "/transactions",
  auth,
  validateGetTransactionHistory,
  getTransactionHistory
);

// @route   GET /wallet/summary
// @desc    Get a summary of the user's wallet activity (topups, bets, wins)
// @access  Private (Authenticated User)
router.get("/summary", auth, getWalletSummary);

module.exports = router;
