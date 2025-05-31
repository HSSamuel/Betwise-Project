const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/authMiddleware");
const { placeBet, getUserBets } = require("../controllers/betController");
const {
  validatePlaceBet,
  validateGetUserBets,
} = require("../controllers/betController");

// @route   POST /bets
// @desc    User: Place a new bet
// @access  Private (Authenticated User)
router.post("/", auth, validatePlaceBet, placeBet);

// @route   GET /bets
// @desc    User: Get all bets for the logged-in user (can add query params for filtering by status, game)
// @access  Private (Authenticated User)
router.get("/", auth, validateGetUserBets, getUserBets);

module.exports = router;
