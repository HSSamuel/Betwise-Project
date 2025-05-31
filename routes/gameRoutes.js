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
const {
  validateCreateGame,
  validateGetGames,
  validateGameId,
  validateSetResult,
  validateUpdateGame,
} = require("../controllers/gameController");

// @route   POST /games
// @desc    Admin: Create a new game
// @access  Private (Admin)
router.post("/", auth, isAdmin, validateCreateGame, createGame);

// @route   GET /games
// @desc    Public: Get list of all available games (can add query params for filtering)
// @access  Public
router.get("/", validateGetGames, getGames); // Assuming getGames is public as per original

// @route   GET /games/:id
// @desc    Public: Get a single game by its ID
// @access  Public
router.get("/:id", validateGameId, getGameById);

// @route   PATCH /games/:id/result
// @desc    Admin: Set the result of a game
// @access  Private (Admin)
router.patch("/:id/result", auth, isAdmin, setResult);

router.patch("/:id/result", auth, isAdmin, validateSetResult, setResult);

// @route   PUT /games/:id
// @desc    Admin: Update game details (e.g., odds, time, status before start)
// @access  Private (Admin)
router.put("/:id", auth, isAdmin, validateUpdateGame, updateGame);

// @route   PATCH /games/:id/cancel
// @desc    Admin: Cancel a game and refund bets
// @access  Private (Admin)
router.patch("/:id/cancel", auth, isAdmin, validateGameId, cancelGame); // validateGameId for the :id param

module.exports = router;
// This file defines the game-related routes for creating, updating, fetching, and managing game results.
