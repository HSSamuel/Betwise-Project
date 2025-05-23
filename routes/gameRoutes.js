const express = require("express");
const router = express.Router();
const {
  createGame,
  getGames,
  setResult,
} = require("../controllers/gameController");
const { auth, isAdmin } = require("../middleware/authMiddleware");

// Admin-only route to create a new game
router.post("/admin/create-game", auth, isAdmin, createGame);

// Admin only - create a new game
router.post("/", auth, isAdmin, createGame);

// Public - get list of all games
router.get("/", getGames);

// Admin only - set the result of a game
router.patch("/:id/result", auth, isAdmin, setResult);

module.exports = router;
