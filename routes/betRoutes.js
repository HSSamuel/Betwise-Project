const express = require("express");
const { auth } = require("../middleware/authMiddleware");
const { placeBet, getUserBets } = require("../controllers/betController");

const router = express.Router();

router.post("/", auth, placeBet); // ✅ This handles POST /bets
router.get("/", auth, getUserBets); // ✅ This handles GET /bets

module.exports = router;
