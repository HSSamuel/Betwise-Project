// In: routes/aiRoutes.js

const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/authMiddleware");
const aiController = require("../controllers/aiController");

// @route   POST /api/ai/chat
// @desc    Handles chat requests to the AI model
// @access  Private (Authenticated User)
router.post("/chat", auth, aiController.handleChat);

// @route   POST /api/ai/parse-bet-intent
// @desc    Parses a user's natural language text to determine their betting intent
// @access  Private (Authenticated User)
router.post("/parse-bet-intent", auth, aiController.parseBetIntent);

// --- NEW ROUTE: Game Analysis ---
// @route   POST /api/ai/analyze-game
// @desc    Provides a brief AI-powered analysis of an upcoming game
// @access  Private (Authenticated User)
router.post(
  "/analyze-game",
  auth,
  aiController.validateAnalyzeGame,
  aiController.analyzeGame
);

// --- NEW ROUTE: Responsible Gambling Feedback ---
// @route   GET /api/ai/my-betting-feedback
// @desc    Provides personalized, non-judgmental feedback on recent betting patterns
// @access  Private (Authenticated User)
router.get("/my-betting-feedback", auth, aiController.getBettingFeedback);

// @route   GET /api/ai/limit-suggestion
// @desc    Get an AI-powered suggestion for weekly betting limits
// @access  Private (Authenticated User)
router.get("/limit-suggestion", auth, aiController.generateLimitSuggestion);

module.exports = router;
