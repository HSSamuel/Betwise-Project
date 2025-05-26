const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/authMiddleware");
const { placeBet, getUserBets } = require("../controllers/betController");

// @route   POST /bets
// @desc    User: Place a new bet
// @access  Private (Authenticated User)
router.post("/", auth, placeBet);

// @route   GET /bets
// @desc    User: Get all bets for the logged-in user (can add query params for filtering by status, game)
// @access  Private (Authenticated User)
router.get("/", auth, getUserBets);

// Future: Could add GET /bets/:id to get a specific bet detail if needed.

module.exports = router;
