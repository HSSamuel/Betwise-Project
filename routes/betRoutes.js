const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/authMiddleware");
const {
  handleValidationErrors,
} = require("../middleware/validationMiddleware"); // <-- IMPORT NEW MIDDLEWARE

const {
  placeBet,
  getUserBets,
  getBetById,
  placeMultiBet,
  validatePlaceBet,
  validateGetUserBets,
  validateGetBetById,
  validatePlaceMultiBet,
} = require("../controllers/betController");

// @route   POST /bets
// @desc    User: Place a new bet
// @access  Private (Authenticated User)
router.post("/", auth, validatePlaceBet, handleValidationErrors, placeBet);

// @route   GET /bets
// @desc    User: Get all bets for the logged-in user
// @access  Private (Authenticated User)
router.get("/", auth, validateGetUserBets, handleValidationErrors, getUserBets);

// @route   GET /bets/:id
// @desc    User: Get a single bet by its ID
// @access  Private (Authenticated User)
router.get(
  "/:id",
  auth,
  validateGetBetById,
  handleValidationErrors,
  getBetById
);

// @route   POST /bets/multi
// @desc    User: Place a new multi-bet (accumulator)
// @access  Private (Authenticated User)
router.post(
  "/multi",
  auth,
  validatePlaceMultiBet,
  handleValidationErrors,
  placeMultiBet
);

module.exports = router;
// This code defines the routes for betting functionality in an Express application, including placing single and multi-bets, retrieving user bets, and getting details of a specific bet. It uses middleware for authentication and validation of requests.