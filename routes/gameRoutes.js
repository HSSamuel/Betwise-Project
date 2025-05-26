const express = require("express");
const router = express.Router();
const {
  createGame,
  getGames,
  getGameById,
  setResult,
  updateGame,
  cancelGame,
} = require("../controllers/gameController");
const { auth, isAdmin } = require("../middleware/authMiddleware");

// @route   POST /games
// @desc    Admin: Create a new game
// @access  Private (Admin)
router.post("/", auth, isAdmin, createGame);

// @route   GET /games
// @desc    Public: Get list of all available games (can add query params for filtering)
// @access  Public
router.get("/", getGames);

// @route   GET /games/:id
// @desc    Public: Get a single game by its ID
// @access  Public
router.get("/:id", getGameById);

// @route   PATCH /games/:id/result
// @desc    Admin: Set the result of a game
// @access  Private (Admin)
router.patch("/:id/result", auth, isAdmin, setResult);

// @route   PUT /games/:id
// @desc    Admin: Update game details (e.g., odds, time, status before start)
// @access  Private (Admin)
router.put("/:id", auth, isAdmin, updateGame); // Using PUT for full/partial update flexibility, or PATCH

// @route   PATCH /games/:id/cancel
// @desc    Admin: Cancel a game and refund bets
// @access  Private (Admin)
router.patch("/:id/cancel", auth, isAdmin, cancelGame);

module.exports = router;
// This file defines the game-related routes for creating, updating, fetching, and managing game results.